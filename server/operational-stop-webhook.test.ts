import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import Stripe from "stripe";
import { createMemoryReceiptJournal } from "./stripe-receipt-store";
import { registerStripeWebhook, type StripeWebhookOptions } from "./stripe-webhook";

const signingSecret = "whsec_operational_stop_unit_fixture";
const privateEmail = "buyer-private@example.test";
let server: Server;
let url: string;
let journal: ReturnType<typeof createMemoryReceiptJournal>;

function checkout() {
  return {
    id: "evt_paid_stop_fixture", object: "event", type: "checkout.session.completed",
    livemode: true, created: Math.floor(Date.now() / 1000),
    data: { object: {
      id: "cs_private_fixture", payment_status: "paid", amount_total: 1500,
      currency: "gbp", customer_email: privateEmail,
      metadata: { private_note: "DO_NOT_RECORD" },
    } },
  };
}

async function post(event: unknown, signature = true) {
  const body = JSON.stringify(event);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) {
    headers["stripe-signature"] = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: signingSecret });
  }
  const res = await fetch(url, { method: "POST", headers, body });
  return { status: res.status, body: await res.json() };
}

async function boot(options: Partial<StripeWebhookOptions> = {}) {
  journal = createMemoryReceiptJournal();
  const app = express();
  registerStripeWebhook(app, {
    journal, connectorId: "stripe:paid:fixture", mode: "live",
    webhookSecret: () => signingSecret, ...options,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("invalid listen address");
  url = `http://127.0.0.1:${addr.port}/api/stripe/webhook`;
}

beforeEach(async () => {
  vi.stubEnv("STRIPE_RECEIPT_SECRET_KEY", "sk_test_receipt_unit_fixture");
  await boot();
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

describe("signed webhook operational stops", () => {
  it("logs a paid Checkout as an unadmitted order, with no private fields", async () => {
    expect(await post(checkout())).toEqual({ status: 200, body: { received: true, disposition: "recorded" } });
    const stop = journal.chain.find((receipt) => receipt.kind === "ops.stop")!;
    expect(stop.payload).toMatchObject({
      state: "OPEN", stage: "PAID_ADMISSION", category: "CONFIG",
      code: "PAID_ADMISSION_NOT_CONFIGURED", next_effect_held: "INTAKE_REQUEST",
      recovery: "BIND_ORDER_AND_REPLAY", exit_check: "ORDER_BOUND_TO_PAYMENT",
    });
    expect(JSON.stringify(stop)).not.toContain(privateEmail);
    expect(JSON.stringify(stop)).not.toContain("cs_private_fixture");
    expect(JSON.stringify(stop)).not.toContain("evt_paid_stop_fixture");
    expect(JSON.stringify(stop)).not.toContain("DO_NOT_RECORD");
    expect(journal.chain.find((receipt) => receipt.kind === "stripe.execution")?.payload)
      .toMatchObject({ result: "RECORDED_ONLY", paid_claim: false, entitlement_granted: false });
    await post(checkout());
    expect(journal.chain.filter((receipt) => receipt.kind === "ops.stop")).toHaveLength(1);
  });

  it("does not acknowledge a signed refused event if its stop cannot be durably appended", async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await boot({ expected: () => null });
    journal.state.failKind = "ops.stop";
    expect((await post(checkout())).status).toBe(500);
    expect(journal.events.size).toBe(0);
    expect(journal.chain.map((receipt) => receipt.kind)).toEqual(["stripe.delivery"]);
    journal.state.failKind = "";
    expect((await post(checkout())).body.disposition).toBe("refused");
    expect(journal.chain.find((receipt) => receipt.kind === "ops.stop")?.payload)
      .toMatchObject({ code: "EXPECTED_ORDER_MISSING", next_effect_held: "INTAKE_REQUEST" });
  });

  it("records missing receipt key as a config stop; a stop fault returns 500", async () => {
    vi.stubEnv("STRIPE_RECEIPT_SECRET_KEY", "");
    journal.state.failKind = "ops.stop";
    expect((await post(checkout())).status).toBe(500);
    expect(journal.chain.map((receipt) => receipt.kind)).toEqual(["stripe.delivery"]);
    journal.state.failKind = "";
    expect((await post(checkout())).status).toBe(503);
    expect(journal.chain.find((receipt) => receipt.kind === "ops.stop")?.payload)
      .toMatchObject({ code: "RECEIPT_KEY_UNAVAILABLE", next_effect_held: "PAID_ADMISSION" });
  });

  it("holds wrong-mode signed events with an operational stop", async () => {
    expect((await post({ ...checkout(), livemode: false })).body.disposition).toBe("held");
    expect(journal.chain.find((receipt) => receipt.kind === "ops.stop")?.payload)
      .toMatchObject({ code: "CONNECTOR_MODE_MISMATCH", next_effect_held: "PAID_ADMISSION" });
    expect(journal.chain.some((receipt) => receipt.kind === "stripe.execution")).toBe(false);
  });

  it("audits an unsigned request but does not claim it is a stopped paid order", async () => {
    expect((await post(checkout(), false)).status).toBe(400);
    expect(journal.chain.map((receipt) => receipt.kind)).toEqual(["stripe.delivery", "stripe.signature"]);
  });
});
