/**
 * Stripe Webhook Handler — record-only receipt patch (PREPARE/TEST).
 *
 * Normal success receipts: Delivery → Signature → Classification → Execution.
 * SAFE is emitted only for authenticated hold / suspension / quarantine.
 *
 * Only authenticated deliveries enter the journal (event_id:null on Delivery).
 * Failed outcome rolls back the record-only op but preserves authenticated Delivery.
 * Unauthenticated/config-lockout requests never open a journal transaction.
 * Admission is bounded per handler before raw parsing; raw bodies are identity-only.
 * No evt_test_ bypass. No customer email/metadata/raw body/secret/signature/IP
 * in receipts or routine logs. No fulfilment invention.
 *
 * Registered BEFORE express.json() to receive raw body for signature verification.
 */
import type {
  Express,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import express from "express";
import Stripe from "stripe";
import { performance } from "node:perf_hooks";
import {
  createMemoryReceiptJournal,
  MysqlReceiptJournal,
  newDeliveryId,
  recordHash,
  sha256Bytes,
  type ReceiptJournal,
  type RecordedEvent,
} from "./stripe-receipt-store.js";

export type ExpectedAmount =
  | { amount: number; currency: string; source: string }
  | null
  | undefined;

export interface StripeWebhookOptions {
  /** Injectable journal (tests). Production: MysqlReceiptJournal from STRIPE_RECEIPT_DATABASE_URL. */
  journal?: ReceiptJournal;
  connectorId?: string;
  /** Connector live/test mode. Must match event.livemode. */
  mode?: "live" | "test";
  clock?: () => string;
  /** Monotonic admission clock (tests). Defaults to performance.now(). */
  admissionClock?: () => number;
  /** Override webhook secret (tests). Default: process.env.STRIPE_WEBHOOK_SECRET. */
  webhookSecret?: () => string | undefined;
  /**
   * Trusted expected amount/currency lookup. Does not create permission.
   * - undefined: record-only observation; expected_amount_match = null
   * - null: required order missing → refuse
   * - {amount,currency,source}: compare; mismatch → refuse
   */
  expected?: (event: Stripe.Event) => ExpectedAmount;
  /**
   * Existing permission check. Default allows record-only observation only.
   * Returning false refuses without inventing a grant.
   */
  permission?: (event: Stripe.Event) => {
    allowed: boolean;
    operation: string;
    authorityRef: string;
    reason?: string;
  };
}

type HttpResult = { status: number; body: Record<string, unknown> };

function defaultJournal(): ReceiptJournal {
  const uri = process.env.STRIPE_RECEIPT_DATABASE_URL;
  if (uri) return new MysqlReceiptJournal(uri);
  // Unconfigured: fail closed at first write rather than inventing durable state.
  return {
    async transact() {
      throw new Error("STRIPE_RECEIPT_JOURNAL_UNCONFIGURED");
    },
  };
}

function observedAmount(event: Stripe.Event): {
  amount: number | null;
  currency: string | null;
} {
  const obj = event.data?.object as unknown as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== "object") return { amount: null, currency: null };
  const amount =
    typeof obj.amount_total === "number"
      ? obj.amount_total
      : typeof obj.amount === "number"
        ? obj.amount
        : null;
  const currency = typeof obj.currency === "string" ? obj.currency : null;
  return { amount, currency };
}

function eventFingerprint(event: Stripe.Event): string {
  // Canonical content — whitespace / key order must not create collisions.
  return recordHash({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    data: event.data,
  });
}

function respond(res: ExpressResponse, result: HttpResult): void {
  res.status(result.status).json(result.body);
}

export function registerStripeWebhook(app: Express, options: StripeWebhookOptions = {}) {
  const journal = options.journal ?? defaultJournal();
  const connectorId =
    options.connectorId ?? process.env.STRIPE_RECEIPT_CONNECTOR_ID ?? "stripe:default";
  // Explicit mode is required. Missing/typo config must not choose a connector scope.
  const mode = options.mode ?? process.env.STRIPE_RECEIPT_MODE;
  const admissionClock = options.admissionClock ?? (() => performance.now());
  let admissionWindowStart = admissionClock();
  let admittedRequests = 0;
  let inFlightRequests = 0;
  const clock = options.clock ?? (() => new Date().toISOString());
  const getSecret =
    options.webhookSecret ?? (() => process.env.STRIPE_WEBHOOK_SECRET);
  const expectedFn = options.expected;
  const permissionFn =
    options.permission ??
    (() => ({
      allowed: true,
      operation: "record",
      authorityRef: "record-only:connector-scope",
    }));

  app.post(
    "/api/stripe/webhook",
    // One constant-size connector-wide bucket. No attacker-selected identities,
    // trust-proxy assumptions, durable logging, or unbounded per-IP maps.
    (req: ExpressRequest, res: ExpressResponse, next) => {
      const now = admissionClock();
      if (now - admissionWindowStart >= 60_000) {
        admissionWindowStart = now;
        admittedRequests = 0;
      }
      if (admittedRequests >= 120) {
        res.set("Retry-After", String(Math.max(1, Math.ceil((60_000 - (now - admissionWindowStart)) / 1000))));
        return res.status(429).json({ error: "Webhook admission limit exceeded" });
      }
      // Bound unfinished body readers and pending storage work across windows.
      if (inFlightRequests >= 8) {
        res.set("Retry-After", "1");
        return res.status(429).json({ error: "Webhook concurrency limit exceeded" });
      }
      admittedRequests++;
      inFlightRequests++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        inFlightRequests--;
      };
      res.once("finish", release);
      res.once("close", release);
      return next();
    },
    express.raw({ type: "application/json", limit: "100kb", inflate: false }),
    async (req: ExpressRequest, res: ExpressResponse) => {
      // A previously parsed body cannot prove the original Stripe-signed bytes.
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ error: "Malformed request" });
      }
      const rawBody: Buffer = req.body;

      // Configuration lockout and forged traffic must never touch durable state.
      if (mode !== "live" && mode !== "test") {
        return res.status(503).json({ error: "Webhook mode configuration unavailable" });
      }
      const secret = getSecret();
      if (!secret?.trim()) {
        return res.status(503).json({ error: "Webhook configuration unavailable" });
      }
      const sigHeader = req.headers["stripe-signature"];
      const sig = typeof sigHeader === "string" ? sigHeader : undefined;
      if (!sig) return res.status(400).json({ error: "Missing signature" });
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey?.trim()) {
        return res.status(503).json({ error: "Stripe configuration unavailable" });
      }

      // SDK signature and timestamp/replay checks happen before the first write.
      // Importing the module or serving unrelated routes requires no payment key.
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2026-02-25.clover",
      });
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      } catch {
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }

      const deliveryId = newDeliveryId();
      const receivedAt = clock();
      const payloadHash = sha256Bytes(rawBody);
      // ── 1. DELIVERY (authenticated; event identity bound in Signature) ──
      try {
        await journal.transact(connectorId, async (tx) => {
          await tx.append("stripe.delivery", {
            connector_id: connectorId,
            delivery_id: deliveryId,
            received_at: receivedAt,
            payload_hash: payloadHash,
            event_id: null,
          });
        });
      } catch {
        return res.status(500).json({ error: "Receipt storage fault" });
      }

      // NOTE: evt_test_ bypass intentionally REMOVED. Test IDs take the full path.

      // ── 3–5. Signature pass + Classification + Execution / hold / refuse ─
      // Atomic with durable dedup. Delivery already committed; rollback here
      // must not erase it.
      let result: HttpResult;
      try {
        result = await journal.transact(connectorId, async (tx) => {
          await tx.append("stripe.signature", {
            verified: true,
            delivery_id: deliveryId,
            event_id: event.id,
            signature_timestamp_trusted: true,
          });

          const fingerprint = eventFingerprint(event);
          const existing = await tx.getEvent(event.id);

          // Verified replay: append-only annotation; return stored response.
          if (existing) {
            if (existing.fingerprint !== fingerprint) {
              // Same authenticated ID, different content → hold (do not re-execute).
              const holdRecord: RecordedEvent = {
                eventId: event.id,
                fingerprint: existing.fingerprint,
                deliveryId: existing.deliveryId,
                disposition: "held",
                response: {
                  status: 200,
                  body: { received: true, disposition: "held" },
                },
              };
              // Do not putEvent again (PK). Update disposition via SAFE evidence only.
              await tx.append("stripe.classification", {
                event_id: event.id,
                event_type: event.type,
                scope_decision: "hold",
                refusal_reason: "event_id_content_collision",
                permitted_operation: null,
                authority_ref: null,
                record_hash: recordHash({
                  ...holdRecord,
                  disposition: "held",
                }),
              });
              await tx.append("stripe.safe", {
                trigger: "event_id_content_collision",
                delivery_id: deliveryId,
                event_id: event.id,
                tier: "event",
                scope: connectorId,
                grants_affected: [],
                notification_sent: false,
              });
              return {
                status: 200,
                body: { received: true, disposition: "held" },
              } satisfies HttpResult;
            }

            await tx.append("stripe.delivery", {
              connector_id: connectorId,
              delivery_id: deliveryId,
              received_at: receivedAt,
              payload_hash: payloadHash,
              event_id: event.id,
              replay: true,
              prior_delivery_id: existing.deliveryId,
            });
            return existing.response;
          }

          // Connector SAFE state (quarantine / suspension).
          if (tx.state === "QUARANTINED" || tx.state === "SUSPENDED") {
            const response: HttpResult = {
              status: 200,
              body: { received: true, disposition: "held" },
            };
            const record: RecordedEvent = {
              eventId: event.id,
              fingerprint,
              deliveryId,
              disposition: "held",
              response,
            };
            const rh = recordHash(record);
            await tx.append("stripe.classification", {
              event_id: event.id,
              event_type: event.type,
              scope_decision: "hold",
              refusal_reason: `connector_${tx.state.toLowerCase()}`,
              permitted_operation: null,
              authority_ref: null,
              observed_amount: observedAmount(event).amount,
              observed_currency: observedAmount(event).currency,
              expected_amount: null,
              expected_amount_match: null,
              record_hash: rh,
            });
            await tx.append("stripe.safe", {
              trigger: tx.state === "QUARANTINED" ? "connector_quarantined" : "connector_suspended",
              delivery_id: deliveryId,
              event_id: event.id,
              tier: "connector",
              scope: connectorId,
              grants_affected: [],
              notification_sent: false,
              observing_existing_state: true,
            });
            await tx.putEvent(record);
            return response;
          }

          // Account / mode scope.
          const expectLive = mode === "live";
          if (Boolean(event.livemode) !== expectLive) {
            const response: HttpResult = {
              status: 200,
              body: { received: true, disposition: "held" },
            };
            const record: RecordedEvent = {
              eventId: event.id,
              fingerprint,
              deliveryId,
              disposition: "held",
              response,
            };
            const rh = recordHash(record);
            await tx.append("stripe.classification", {
              event_id: event.id,
              event_type: event.type,
              scope_decision: "hold",
              refusal_reason: "mode_mismatch",
              permitted_operation: null,
              authority_ref: null,
              observed_livemode: event.livemode,
              connector_mode: mode,
              expected_amount: null,
              expected_amount_match: null,
              record_hash: rh,
            });
            await tx.append("stripe.safe", {
              trigger: "mode_mismatch",
              delivery_id: deliveryId,
              event_id: event.id,
              tier: "connector",
              scope: connectorId,
              grants_affected: [],
              notification_sent: false,
            });
            await tx.putEvent(record);
            return response;
          }

          // ── CLASSIFICATION / AUTHORITY GATE ────────────────────────────
          const observed = observedAmount(event);
          const expected = expectedFn ? expectedFn(event) : undefined;
          let expectedAmount: number | null = null;
          let expectedCurrency: string | null = null;
          let expectedSource: string | null = null;
          let expectedAmountMatch: boolean | null = null;
          let scopeDecision: "record" | "refuse" | "hold" = "record";
          let refusalReason: string | null = null;

          if (expected === null) {
            // Explicit missing required order — cannot report as a match.
            expectedAmountMatch = null;
            scopeDecision = "refuse";
            refusalReason = "missing_expected_order";
          } else if (expected && typeof expected === "object") {
            expectedAmount = expected.amount;
            expectedCurrency = expected.currency;
            expectedSource = expected.source;
            const amountOk = observed.amount === expected.amount;
            const currencyOk =
              (observed.currency ?? "").toLowerCase() === expected.currency.toLowerCase();
            expectedAmountMatch = amountOk && currencyOk;
            if (!expectedAmountMatch) {
              scopeDecision = "refuse";
              refusalReason = amountOk ? "currency_mismatch" : "amount_mismatch";
            }
          } else {
            // No trusted expected binding configured: record-only observation.
            expectedAmountMatch = null;
          }

          const perm = permissionFn(event);
          if (scopeDecision === "record" && !perm.allowed) {
            scopeDecision = "refuse";
            refusalReason = perm.reason ?? "permission_denied";
          }

          // Valid signature + matching price are not, by themselves, authority.
          // This cut only permits record-only observation within approved scope.
          const permittedOperation =
            scopeDecision === "record" ? perm.operation : null;
          const authorityRef =
            scopeDecision === "record" ? perm.authorityRef : null;

          if (scopeDecision === "refuse") {
            const response: HttpResult = {
              status: 200,
              body: { received: true, disposition: "refused" },
            };
            const record: RecordedEvent = {
              eventId: event.id,
              fingerprint,
              deliveryId,
              disposition: "refused",
              response,
            };
            const rh = recordHash(record);
            await tx.append("stripe.classification", {
              event_id: event.id,
              event_type: event.type,
              observed_amount: observed.amount,
              observed_currency: observed.currency,
              expected_amount: expectedAmount,
              expected_currency: expectedCurrency,
              expected_source: expectedSource,
              expected_amount_match: expectedAmountMatch,
              permitted_operation: permittedOperation,
              authority_ref: authorityRef,
              scope_decision: "refuse",
              refusal_reason: refusalReason,
              record_hash: rh,
            });
            await tx.putEvent(record);
            return response;
          }

          // Success path classification (record-only).
          const response: HttpResult = {
            status: 200,
            body: { received: true, disposition: "recorded" },
          };
          const record: RecordedEvent = {
            eventId: event.id,
            fingerprint,
            deliveryId,
            disposition: "recorded",
            response,
          };
          const rh = recordHash(record);

          await tx.append("stripe.classification", {
            event_id: event.id,
            event_type: event.type,
            observed_amount: observed.amount,
            observed_currency: observed.currency,
            expected_amount: expectedAmount,
            expected_currency: expectedCurrency,
            expected_source: expectedSource,
            expected_amount_match: expectedAmountMatch,
            permitted_operation: permittedOperation,
            authority_ref: authorityRef,
            scope_decision: "record",
            refusal_reason: null,
            record_hash: rh,
          });

          // ── EXECUTION: RECORDED_ONLY (no fulfilment / provisioning) ────
          await tx.putEvent(record);
          await tx.append("stripe.execution", {
            event_id: event.id,
            delivery_id: deliveryId,
            operation: "record",
            result: "RECORDED_ONLY",
            authority: authorityRef,
            source: "stripe.webhook",
            idempotency_key: `${connectorId}:${event.id}`,
            evidence_pointer: `receipt:record_hash:${rh}`,
            review_state: "recorded",
            record_hash: rh,
            // Explicit non-claims:
            provisioned: false,
            paid_claim: false,
            entitlement_granted: false,
          });

          // SAFE absent on normal success.
          return response;
        });
      } catch {
        return res.status(500).json({ error: "Receipt storage fault" });
      }

      // Routine log: disposition only — never email, metadata, raw body, secret, signature, IP.
      console.log(
        `[Stripe Webhook] connector=${connectorId} delivery=${deliveryId} disposition=${String(result.body.disposition ?? "ok")}`,
      );
      return respond(res, result);
    },
  );
}

// Re-export test helper surface (not used in production registration).
export { createMemoryReceiptJournal };
