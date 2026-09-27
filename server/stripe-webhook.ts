/**
 * Stripe Webhook Handler — record-only receipt patch (PREPARE/TEST).
 *
 * Normal success receipts: Delivery → Signature → Classification → Execution.
 * SAFE is emitted only for hold / suspension / quarantine / config lockout.
 *
 * Delivery commits BEFORE signature verification with event_id:null.
 * Failed outcome rolls back the record-only op but preserves Delivery.
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
import {
  createMemoryReceiptJournal,
  MysqlReceiptJournal,
  newDeliveryId,
  recordHash,
  sha256Bytes,
  type ReceiptJournal,
  type RecordedEvent,
} from "./stripe-receipt-store.js";
import { appendOperationalStop, type OpenOperationalStop } from "./operational-stop-log.js";

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

function webhookStop(
  deliveryId: string,
  evidenceHash: string,
  fields: Pick<OpenOperationalStop, "stage" | "category" | "code" | "heldEffect" | "recovery" | "exitCheck">,
): OpenOperationalStop {
  return {
    correlationId: deliveryId,
    ...fields,
    owner: "PRODUCTION_ENGINEERING",
    evidenceRefs: [`receipt:sha256:${evidenceHash}`],
  };
}

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
  const mode: "live" | "test" =
    options.mode ?? (process.env.STRIPE_RECEIPT_MODE === "live" ? "live" : "test");
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
    express.raw({ type: "application/json" }),
    async (req: ExpressRequest, res: ExpressResponse) => {
      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? ""));

      // Reject empty / clearly malformed before any durable write amplification.
      if (!rawBody.length) {
        return res.status(400).json({ error: "Malformed request" });
      }

      const sigHeader = req.headers["stripe-signature"];
      const sig = typeof sigHeader === "string" ? sigHeader : undefined;
      const deliveryId = newDeliveryId();
      const receivedAt = clock();
      const payloadHash = sha256Bytes(rawBody);
      let deliveryEvidenceHash: string;

      // ── 1. DELIVERY (before verify; event_id must be null) ──────────────
      try {
        deliveryEvidenceHash = await journal.transact(connectorId, async (tx) => {
          const receipt = await tx.append("stripe.delivery", {
            connector_id: connectorId,
            delivery_id: deliveryId,
            received_at: receivedAt,
            payload_hash: payloadHash,
            event_id: null,
          });
          return receipt.hash;
        });
      } catch {
        return res.status(500).json({ error: "Receipt storage fault" });
      }

      const secret = getSecret();

      // Missing configuration after Delivery: SAFE + 503 (not a forged-ack 200).
      if (!secret) {
        try {
          await journal.transact(connectorId, async (tx) => {
            await appendOperationalStop(tx, webhookStop(deliveryId, deliveryEvidenceHash, {
              stage: "PAYMENT_BINDING", category: "CONFIG", code: "WEBHOOK_SECRET_UNAVAILABLE",
              heldEffect: "PAID_ADMISSION", recovery: "CONFIGURE_WEBHOOK_AND_REPLAY",
              exitCheck: "SIGNED_EVENT_REPLAY_RECORDED",
            }));
            await tx.append("stripe.safe", {
              trigger: "missing_webhook_secret",
              delivery_id: deliveryId,
              tier: "connector",
              scope: connectorId,
              grants_affected: [],
              notification_sent: false,
            });
          });
        } catch {
          return res.status(500).json({ error: "Receipt storage fault" });
        }
        return res.status(503).json({ error: "Webhook configuration unavailable" });
      }

      if (!sig) {
        try {
          await journal.transact(connectorId, async (tx) => {
            await tx.append("stripe.signature", {
              verified: false,
              delivery_id: deliveryId,
              event_id: null,
              reason: "missing_signature_header",
              signature_timestamp: null,
              signature_timestamp_trusted: false,
            });
          });
        } catch {
          return res.status(500).json({ error: "Receipt storage fault" });
        }
        return res.status(400).json({ error: "Missing signature" });
      }

      // ── 2. SIGNATURE verify (SDK retains timestamp/replay protection) ───
      // Construct the SDK only when a signed request reaches verification.
      // Importing the module or serving unrelated routes must not require a payment key.
      // This receipt endpoint is configured independently from checkout and
      // Promotion Fix. Never fall back to their STRIPE_SECRET_KEY: a checkout
      // merchant change must not silently reconfigure this connector.
      const stripeSecretKey = process.env.STRIPE_RECEIPT_SECRET_KEY;
      if (!stripeSecretKey) {
        try {
          await journal.transact(connectorId, async (tx) => {
            await appendOperationalStop(tx, webhookStop(deliveryId, deliveryEvidenceHash, {
              stage: "PAYMENT_BINDING", category: "CONFIG", code: "RECEIPT_KEY_UNAVAILABLE",
              heldEffect: "PAID_ADMISSION", recovery: "CONFIGURE_RECEIPT_KEY_AND_REPLAY",
              exitCheck: "SIGNED_EVENT_REPLAY_RECORDED",
            }));
            await tx.append("stripe.safe", {
              trigger: "missing_stripe_receipt_secret_key",
              delivery_id: deliveryId,
              tier: "connector",
              scope: connectorId,
              grants_affected: [],
              notification_sent: false,
            });
          });
        } catch {
          return res.status(500).json({ error: "Receipt storage fault" });
        }
        return res.status(503).json({ error: "Stripe configuration unavailable" });
      }
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2026-02-25.clover",
      });
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      } catch {
        try {
          await journal.transact(connectorId, async (tx) => {
            await tx.append("stripe.signature", {
              verified: false,
              delivery_id: deliveryId,
              event_id: null,
              reason: "verification_failed",
              // Do not attest attacker-supplied header values as Stripe facts.
              signature_timestamp: null,
              signature_timestamp_trusted: false,
            });
          });
        } catch {
          return res.status(500).json({ error: "Receipt storage fault" });
        }
        return res.status(400).json({ error: "Webhook signature verification failed" });
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
              const classification = await tx.append("stripe.classification", {
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
              await appendOperationalStop(tx, webhookStop(deliveryId, classification.hash, {
                stage: "PAYMENT_BINDING", category: "DATA", code: "EVENT_COLLISION",
                heldEffect: "PAID_ADMISSION", recovery: "REVIEW_CONNECTOR_AND_REPLAY",
                exitCheck: "CONNECTOR_SCOPE_VERIFIED",
              }));
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
            const classification = await tx.append("stripe.classification", {
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
            await appendOperationalStop(tx, webhookStop(deliveryId, classification.hash, {
              stage: "PAYMENT_BINDING", category: "AUTHORITY", code: "CONNECTOR_NOT_ACTIVE",
              heldEffect: "PAID_ADMISSION", recovery: "REVIEW_CONNECTOR_AND_REPLAY",
              exitCheck: "CONNECTOR_SCOPE_VERIFIED",
            }));
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
            const classification = await tx.append("stripe.classification", {
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
            await appendOperationalStop(tx, webhookStop(deliveryId, classification.hash, {
              stage: "PAYMENT_BINDING", category: "CONFIG", code: "CONNECTOR_MODE_MISMATCH",
              heldEffect: "PAID_ADMISSION", recovery: "REVIEW_CONNECTOR_AND_REPLAY",
              exitCheck: "CONNECTOR_SCOPE_VERIFIED",
            }));
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
            const classification = await tx.append("stripe.classification", {
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
            const priceFailure = refusalReason === "amount_mismatch" || refusalReason === "currency_mismatch";
            await appendOperationalStop(tx, webhookStop(deliveryId, classification.hash, {
              stage: "PAID_ADMISSION",
              category: priceFailure || refusalReason === "missing_expected_order" ? "DATA" : "AUTHORITY",
              code: priceFailure ? "PRICE_MISMATCH" :
                refusalReason === "missing_expected_order" ? "EXPECTED_ORDER_MISSING" : "AUTHORITY_REFUSED",
              heldEffect: "INTAKE_REQUEST",
              recovery: priceFailure || refusalReason === "missing_expected_order" ?
                "BIND_ORDER_AND_REPLAY" : "REVIEW_AND_RETRY",
              exitCheck: "ORDER_BOUND_TO_PAYMENT",
            }));
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
          const execution = await tx.append("stripe.execution", {
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

          // A signed paid Checkout observation is not an admitted order. Until
          // a trusted order binding and authorised intake exist, log that stop
          // before acknowledging the record-only receipt.
          const checkout = event.data.object as unknown as Record<string, unknown>;
          if (event.type === "checkout.session.completed" && checkout.payment_status === "paid") {
            await appendOperationalStop(tx, webhookStop(deliveryId, execution.hash, {
              stage: "PAID_ADMISSION", category: "CONFIG", code: "PAID_ADMISSION_NOT_CONFIGURED",
              heldEffect: "INTAKE_REQUEST", recovery: "BIND_ORDER_AND_REPLAY",
              exitCheck: "ORDER_BOUND_TO_PAYMENT",
            }));
          }

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
