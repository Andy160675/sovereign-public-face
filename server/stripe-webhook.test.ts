/**
 * Discriminating suite for STRIPE-RECEIPT-PATCH-001 (Chair corrections A–J).
 * Synthetic Stripe signature fixture only — no live Stripe / MySQL.
 * In-memory journal proves handler semantics, NOT production DB locking.
 *
 * Status: DRAFT against injectable handler. Run on Blade forge worktree to verify.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { createMemoryReceiptJournal, receiptRuntime, type MemoryReceiptJournal } from "./stripe-receipt-store";
import { registerStripeWebhook } from "./stripe-webhook";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const verifyChain = (chain: Parameters<ReturnType<typeof receiptRuntime>["verifyChain"]>[0]) =>
  receiptRuntime().verifyChain(chain);

const secret = "whsec_unit_test_only_not_a_provider_secret";

function event(id = "evt_unit_a", overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "cs_test_unit",
        amount_total: 299700,
        currency: "gbp",
        customer_email: "private@example.test",
        metadata: { private: "NEVER_LOG_ME" },
      },
    },
    ...overrides,
  };
}

let expectedPolicy: ((e: unknown) => unknown) | undefined;
let server: Server;
let base: string;
let journal: MemoryReceiptJournal;
let configuredSecret = secret;

async function post(value: unknown, signature?: string) {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  const sig =
    signature ??
    Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const r = await fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sig },
    body,
  });
  return { status: r.status, body: await r.json() };
}

async function boot(j: MemoryReceiptJournal) {
  expectedPolicy = undefined;
  journal = j;
  configuredSecret = secret;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_receipt_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  const app = express();
  registerStripeWebhook(app, {
    journal,
    connectorId: "stripe:unit:test",
    mode: "test",
    webhookSecret: () => configuredSecret,
    expected: (ev) => expectedPolicy?.(ev) as never,
  });
  app.get("/health", (_req, res) => res.json({ ok: true }));
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("address");
  base = `http://127.0.0.1:${addr.port}`;
}

beforeEach(async () => {
  await boot(createMemoryReceiptJournal());
});

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  vi.unstubAllEnvs();
});

describe("Stripe receipt patch (no provisioning)", () => {
  it("A: records delivery, signature, classification and record-only execution", async () => {
    expect((await post(event())).status).toBe(200);
    expect(journal.chain.map((r) => r.kind)).toEqual([
      "stripe.delivery",
      "stripe.signature",
      "stripe.classification",
      "stripe.execution",
    ]);
    expect(journal.events.size).toBe(1);
    expect(verifyChain(journal.chain).valid).toBe(true);
    expect(journal.chain.at(-1)!.payload).toMatchObject({
      result: "RECORDED_ONLY",
      operation: "record",
    });
    expect(journal.chain.some((r) => r.kind === "stripe.safe")).toBe(false);
  });

  it("removes evt_test_ bypass — test IDs take the full receipt path", async () => {
    expect((await post(event("evt_test_fixture"))).status).toBe(200);
    expect(journal.chain.at(-1)?.kind).toBe("stripe.execution");
  });

  it("I: no unverified identity, raw payload, customer fields, IP or signature in receipts", async () => {
    await post(event());
    const d = journal.chain.find((r) => r.kind === "stripe.delivery")!;
    expect(d.payload).toMatchObject({ event_id: null });
    expect((d.payload as { payload_hash: string }).payload_hash).toMatch(/^[a-f0-9]{64}$/);
    const text = JSON.stringify(journal.chain);
    for (const v of [
      "private@example.test",
      "NEVER_LOG_ME",
      "customer_email",
      secret,
      "127.0.0.1",
    ]) {
      expect(text).not.toContain(v);
    }
    expect(
      (journal.chain.find((r) => r.kind === "stripe.classification")!.payload as { expected_amount: unknown })
        .expected_amount,
    ).toBeNull();
  });

  it("C: forged body cannot poison idempotency for a genuine event", async () => {
    expect((await post(event(), "t=1,v1=forged")).status).toBe(400);
    expect(journal.events.size).toBe(0);
    expect(journal.chain.map((r) => r.kind)).toEqual(["stripe.delivery", "stripe.signature"]);
    expect((journal.chain[1]!.payload as { event_id: unknown }).event_id).toBeNull();
    expect((await post(event())).status).toBe(200);
    expect(journal.events.size).toBe(1);
  });

  it("E: duplicate delivery verifies again and appends replay without editing history", async () => {
    const v = event();
    const first = await post(v);
    const n = journal.chain.length;
    expect(await post(v)).toEqual(first);
    expect(journal.chain.slice(n).map((r) => r.kind)).toEqual([
      "stripe.delivery",
      "stripe.signature",
      "stripe.delivery",
    ]);
    expect((journal.chain.at(-1)!.payload as { replay?: boolean }).replay).toBe(true);
    expect(journal.chain.filter((r) => r.kind === "stripe.execution")).toHaveLength(1);
  });

  it("JSON whitespace and key order are not event collisions", async () => {
    const v = event();
    await post(v);
    expect(
      (
        await post(
          JSON.stringify(Object.fromEntries(Object.entries(v).reverse()), null, 2),
        )
      ).status,
    ).toBe(200);
    expect((journal.chain.at(-1)!.payload as { replay?: boolean }).replay).toBe(true);
  });

  it("same authenticated ID with different contents is held, not re-executed", async () => {
    const v = event();
    await post(v);
    const r = await post({
      ...v,
      data: { object: { amount_total: 1, currency: "gbp" } },
    });
    expect(r.body.disposition).toBe("held");
    expect(journal.chain.at(-1)!.kind).toBe("stripe.safe");
    expect((journal.chain.at(-1)!.payload as { notification_sent: boolean }).notification_sent).toBe(
      false,
    );
    expect(journal.chain.filter((r) => r.kind === "stripe.execution")).toHaveLength(1);
  });

  it.each([
    "stripe.delivery",
    "stripe.signature",
    "stripe.classification",
    "stripe.execution",
  ] as const)(
    "F: a %s write fault rolls back the operation but preserves an earlier committed delivery",
    async (kind) => {
      journal.state.failKind = kind;
      expect((await post(event())).status).toBe(500);
      expect(journal.events.size).toBe(0);
      expect(journal.chain).toHaveLength(kind === "stripe.delivery" ? 0 : 1);
      journal.state.failKind = "";
      expect((await post(event())).status).toBe(200);
    },
  );

  it("F: commit failure is not acknowledged as successful processing", async () => {
    journal.state.failCommit = true;
    expect((await post(event())).status).toBe(500);
    expect(journal.events.size).toBe(0);
  });

  it("B: SAFE observation holds without claiming execution or notification", async () => {
    journal.state.mode = "QUARANTINED";
    expect(await post(event())).toEqual({
      status: 200,
      body: { received: true, disposition: "held" },
    });
    expect(journal.chain.at(-1)!.kind).toBe("stripe.safe");
    expect((journal.chain.at(-1)!.payload as { notification_sent: boolean }).notification_sent).toBe(
      false,
    );
    expect(journal.chain.some((r) => r.kind === "stripe.execution")).toBe(false);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it("SAFE receipt failure is not acknowledged", async () => {
    journal.state.mode = "SUSPENDED";
    journal.state.failKind = "stripe.safe";
    expect((await post(event())).status).toBe(500);
    expect(journal.events.size).toBe(0);
  });

  it("held events do not silently resume when the connector becomes active", async () => {
    const v = event();
    journal.state.mode = "QUARANTINED";
    await post(v);
    journal.state.mode = "ACTIVE";
    expect((await post(v)).body.disposition).toBe("held");
    expect(journal.chain.some((r) => r.kind === "stripe.execution")).toBe(false);
  });

  it("D: live events cannot cross into the test connector", async () => {
    expect((await post(event("evt_mode", { livemode: true }))).body.disposition).toBe("held");
    expect(journal.chain.some((r) => r.kind === "stripe.execution")).toBe(false);
  });

  it("G: legitimate out-of-order events are recorded, not treated as abuse", async () => {
    await post(event("evt_newer", { created: 100 }));
    await post(event("evt_older", { created: 10 }));
    expect(journal.events.size).toBe(2);
    expect(journal.chain.some((r) => r.kind === "stripe.safe")).toBe(false);
  });

  it("E: parallel identical requests do not repeat the record-only operation", async () => {
    const v = event();
    const results = await Promise.all(Array.from({ length: 8 }, () => post(v)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(journal.events.size).toBe(1);
    expect(journal.chain.filter((r) => r.kind === "stripe.execution")).toHaveLength(1);
    expect(verifyChain(journal.chain).valid).toBe(true);
  });

  it("E: restart recovery — durable snapshot replay returns stored response", async () => {
    const v = event("evt_restart");
    const first = await post(v);
    expect(first.status).toBe(200);
    const snap = journal.snapshot();
    // Simulate process restart: new journal seeded from durable snapshot, new HTTP server.
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await boot(
      createMemoryReceiptJournal({
        chain: snap.chain,
        events: snap.events,
        mode: snap.mode,
      }),
    );
    const second = await post(v);
    expect(second).toEqual(first);
    expect(journal.events.size).toBe(1);
    expect(journal.chain.filter((r) => r.kind === "stripe.execution")).toHaveLength(1);
    expect((journal.chain.at(-1)!.payload as { replay?: boolean }).replay).toBe(true);
    expect(verifyChain(journal.chain).valid).toBe(true);
  });

  it("missing signing configuration holds rather than accepts an event", async () => {
    configuredSecret = "";
    expect((await post(event())).status).toBe(503);
    expect(journal.events.size).toBe(0);
    expect(journal.chain.at(-1)?.kind).toBe("stripe.safe");
  });
});

describe("corrected acceptance cases", () => {
  it("SAFE is absent from the normal success path", async () => {
    await post(event());
    expect(journal.chain.some((r) => r.kind === "stripe.safe")).toBe(false);
  });

  it("D: a trusted amount mismatch refuses the operation", async () => {
    expectedPolicy = () => ({ amount: 75000, currency: "gbp", source: "fixture:order" });
    expect((await post(event())).body.disposition).toBe("refused");
    const c = journal.chain.find((r) => r.kind === "stripe.classification")!;
    expect(c.payload).toMatchObject({
      expected_amount_match: false,
      scope_decision: "refuse",
    });
    expect(journal.chain.some((r) => r.kind === "stripe.execution")).toBe(false);
  });

  it("D: a trusted currency mismatch refuses even when amount matches", async () => {
    expectedPolicy = () => ({ amount: 299700, currency: "eur", source: "fixture:order" });
    expect((await post(event())).body.disposition).toBe("refused");
    expect(journal.chain.some((r) => r.kind === "stripe.execution")).toBe(false);
  });

  it("D: a missing expected order cannot be reported as a match", async () => {
    expectedPolicy = () => null;
    expect((await post(event())).body.disposition).toBe("refused");
    expect(
      (journal.chain.find((r) => r.kind === "stripe.classification")!.payload as {
        expected_amount_match: unknown;
      }).expected_amount_match,
    ).toBeNull();
  });

  it("G: twenty out-of-order events produce contiguous per-connector receipt indices", async () => {
    for (let n = 19; n >= 0; n--) await post(event(`evt_batch_${n}`, { created: n }));
    expect(journal.events.size).toBe(20);
    expect(journal.chain).toHaveLength(80);
    expect(journal.chain.map((r) => r.index)).toEqual(Array.from({ length: 80 }, (_, n) => n));
    expect(verifyChain(journal.chain).valid).toBe(true);
  });

  it("C: an expired signature is refused and cannot reserve an event ID", async () => {
    const value = event();
    const payload = JSON.stringify(value);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: 1,
    });
    expect((await post(payload, signature)).status).toBe(400);
    expect(journal.events.size).toBe(0);
  });

  it("unpaid checkout is only recorded; no entitlement or payment-success claim", async () => {
    const value = event();
    (value.data.object as { payment_status?: string }).payment_status = "unpaid";
    await post(value);
    expect(journal.chain.at(-1)!.payload).toMatchObject({
      result: "RECORDED_ONLY",
      operation: "record",
      provisioned: false,
      paid_claim: false,
      entitlement_granted: false,
    });
  });
});

describe("signed payment and refund event observations (RECORDED_ONLY)", () => {
  // These are signed provider-shaped observations, not a payment/refund ledger.
  // In particular, charge.refunded carries the original charge amount; this
  // handler does not derive a refund delta or assert that a refund succeeded.
  it.each([
    {
      label: "successful PaymentIntent",
      type: "payment_intent.succeeded",
      object: {
        id: "pi_matrix", object: "payment_intent", amount: 1500,
        amount_received: 1500, currency: "gbp", status: "succeeded",
        latest_charge: "ch_matrix",
      },
      observedAmount: 1500,
    },
    {
      label: "successful Charge",
      type: "charge.succeeded",
      object: {
        id: "ch_matrix", object: "charge", amount: 1500,
        amount_captured: 1500, amount_refunded: 0, currency: "gbp",
        payment_intent: "pi_matrix", paid: true, refunded: false,
      },
      observedAmount: 1500,
    },
    {
      label: "partially refunded Charge (original amount observed, no refund delta)",
      type: "charge.refunded",
      object: {
        id: "ch_matrix", object: "charge", amount: 1500,
        amount_captured: 1500, amount_refunded: 500, currency: "gbp",
        payment_intent: "pi_matrix", paid: true, refunded: false,
        refunds: {
          object: "list", has_more: false, url: "/v1/charges/ch_matrix/refunds",
          data: [{
            id: "re_matrix", object: "refund", amount: 500, currency: "gbp",
            charge: "ch_matrix", payment_intent: "pi_matrix", status: "succeeded",
          }],
        },
      },
      observedAmount: 1500,
    },
    {
      label: "created pending Refund",
      type: "refund.created",
      object: {
        id: "re_matrix", object: "refund", amount: 500, currency: "gbp",
        charge: "ch_matrix", payment_intent: "pi_matrix", status: "pending",
      },
      observedAmount: 500,
    },
    {
      label: "updated succeeded Refund",
      type: "refund.updated",
      object: {
        id: "re_matrix", object: "refund", amount: 500, currency: "gbp",
        charge: "ch_matrix", payment_intent: "pi_matrix", status: "succeeded",
      },
      observedAmount: 500,
    },
    {
      label: "failed Refund",
      type: "refund.failed",
      object: {
        id: "re_matrix", object: "refund", amount: 500, currency: "gbp",
        charge: "ch_matrix", payment_intent: "pi_matrix", status: "failed",
        failure_reason: "lost_or_stolen_card",
      },
      observedAmount: 500,
    },
  ])("records $label without a paid or entitlement claim", async ({ type, object, observedAmount }) => {
    const value = event("evt_matrix", { type, data: { object } });
    expect(await post(value)).toEqual({
      status: 200,
      body: { received: true, disposition: "recorded" },
    });
    expect(journal.chain.map((receipt) => receipt.kind)).toEqual([
      "stripe.delivery", "stripe.signature", "stripe.classification", "stripe.execution",
    ]);
    expect(journal.chain.find((receipt) => receipt.kind === "stripe.signature")!.payload)
      .toMatchObject({ verified: true, event_id: "evt_matrix" });
    expect(journal.chain.find((receipt) => receipt.kind === "stripe.classification")!.payload)
      .toMatchObject({
        event_id: "evt_matrix", event_type: type,
        observed_amount: observedAmount, observed_currency: "gbp",
        expected_amount: null, expected_amount_match: null,
        scope_decision: "record", permitted_operation: "record",
      });
    expect(journal.chain.at(-1)!.payload).toMatchObject({
      event_id: "evt_matrix", operation: "record", result: "RECORDED_ONLY",
      provisioned: false, paid_claim: false, entitlement_granted: false,
    });
    expect(journal.events.size).toBe(1);
    expect(verifyChain(journal.chain).valid).toBe(true);
  });

  it("keeps distinct PaymentIntent and Charge events for one payment as separate record-only receipts", async () => {
    const intent = event("evt_linked_intent", {
      type: "payment_intent.succeeded",
      data: { object: {
        id: "pi_linked", object: "payment_intent", amount: 1500,
        amount_received: 1500, currency: "gbp", status: "succeeded",
        latest_charge: "ch_linked",
      } },
    });
    const charge = event("evt_linked_charge", {
      type: "charge.succeeded",
      data: { object: {
        id: "ch_linked", object: "charge", amount: 1500,
        amount_captured: 1500, amount_refunded: 0, currency: "gbp",
        payment_intent: "pi_linked", paid: true, refunded: false,
      } },
    });

    expect((await post(intent)).body).toEqual({ received: true, disposition: "recorded" });
    expect((await post(charge)).body).toEqual({ received: true, disposition: "recorded" });
    // Re-delivery of each event must not create a third record-only execution.
    expect((await post(intent)).status).toBe(200);
    expect((await post(charge)).status).toBe(200);
    expect([...journal.events.keys()]).toEqual(["evt_linked_intent", "evt_linked_charge"]);
    const executions = journal.chain.filter((receipt) => receipt.kind === "stripe.execution");
    expect(executions.map((receipt) => receipt.payload)).toEqual([
      expect.objectContaining({
        event_id: "evt_linked_intent", idempotency_key: "stripe:unit:test:evt_linked_intent",
        operation: "record", result: "RECORDED_ONLY",
        provisioned: false, paid_claim: false, entitlement_granted: false,
      }),
      expect.objectContaining({
        event_id: "evt_linked_charge", idempotency_key: "stripe:unit:test:evt_linked_charge",
        operation: "record", result: "RECORDED_ONLY",
        provisioned: false, paid_claim: false, entitlement_granted: false,
      }),
    ]);
    expect(verifyChain(journal.chain).valid).toBe(true);
  });
});
