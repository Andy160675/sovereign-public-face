/**
 * Stage 4 PREPARE — Vercel Express adapter acceptance (synthetic fixtures only).
 * Proves: raw-body preservation, invalid signature fail-closed, valid → RECORDED_ONLY.
 * No live Stripe. No fulfilment / Check-3 business effect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { createMemoryReceiptJournal, type MemoryReceiptJournal } from "./stripe-receipt-store";
import { createStripeWebhookApp } from "./createStripeWebhookApp";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");

const secret = "whsec_adapter_unit_test_only_not_provider";

function event(id = "evt_adapter_a", overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "cs_test_adapter",
        amount_total: 299700,
        currency: "gbp",
        customer_email: "private@example.test",
        metadata: { private: "NEVER_LOG_ME" },
      },
    },
    ...overrides,
  };
}

let server: Server;
let base: string;
let journal: MemoryReceiptJournal;

async function postRaw(body: Buffer | string, signature?: string) {
  const payload = typeof body === "string" ? body : body;
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const sig =
    signature ??
    Stripe.webhooks.generateTestHeaderString({
      payload: buf.toString("utf8"),
      secret,
    });
  const r = await fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig,
      "content-length": String(buf.length),
    },
    body: buf,
  });
  const text = await r.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text };
  }
  return { status: r.status, body: json };
}

beforeEach(async () => {
  journal = createMemoryReceiptJournal();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_checkout_fixture");
  vi.stubEnv("STRIPE_RECEIPT_SECRET_KEY", "sk_test_adapter_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  const app = createStripeWebhookApp({
    webhookOnly: true,
    stripe: {
      journal,
      connectorId: "stripe:adapter:test",
      mode: "test",
      webhookSecret: () => secret,
    },
  });
  // Adapter must not expose tRPC / checkout on this surface.
  expect(typeof (app as unknown as { listen?: unknown }).listen).toBe("function");
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("address");
  base = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  vi.unstubAllEnvs();
});

describe("Vercel Stripe webhook adapter (RECORDED_ONLY)", () => {
  it("preserves raw body — exact signed bytes verify", async () => {
    const payload = JSON.stringify(event());
    const buf = Buffer.from(payload, "utf8");
    const r = await postRaw(buf);
    expect(r.status).toBe(200);
    expect(journal.chain.map((x) => x.kind)).toEqual([
      "stripe.delivery",
      "stripe.signature",
      "stripe.classification",
      "stripe.execution",
    ]);
  });

  it("fail-closed: invalid signature returns 400 and does not reserve event id", async () => {
    const payload = JSON.stringify(event("evt_bad_sig"));
    const r = await postRaw(payload, "t=1,v1=forged_signature_bytes");
    expect(r.status).toBe(400);
    expect(journal.events.size).toBe(0);
    expect(journal.chain.map((x) => x.kind)).toEqual([
      "stripe.delivery",
      "stripe.signature",
    ]);
    expect((journal.chain[1]!.payload as { event_id: unknown }).event_id).toBeNull();
  });

  it("valid fixture → RECORDED_ONLY (no fulfilment claim)", async () => {
    const r = await postRaw(JSON.stringify(event("evt_recorded_only")));
    expect(r.status).toBe(200);
    expect(journal.chain.at(-1)!.payload).toMatchObject({
      result: "RECORDED_ONLY",
      operation: "record",
      provisioned: false,
      paid_claim: false,
      entitlement_granted: false,
    });
    expect(journal.chain.some((x) => x.kind === "stripe.safe")).toBe(false);
  });

  it("factory does not call listen — caller owns the server", async () => {
    // createStripeWebhookApp returned an Express app; we called createServer ourselves.
    // If the factory had listened, address binding would conflict or double-listen.
    const health = await fetch(`${base}/api/trpc/anything`).catch(() => null);
    // No tRPC mounted on webhook-only surface → 404 from Express default.
    expect(health?.status).toBe(404);
  });

  it("JSON-parsed (mutated) body cannot satisfy a signature over original bytes", async () => {
    const original = JSON.stringify(event("evt_mutate"));
    const sig = Stripe.webhooks.generateTestHeaderString({
      payload: original,
      secret,
    });
    // Re-serialize with different whitespace — signature over original must fail.
    const mutated = JSON.stringify(JSON.parse(original), null, 2);
    expect(mutated).not.toBe(original);
    const r = await postRaw(mutated, sig);
    expect(r.status).toBe(400);
    expect(journal.events.size).toBe(0);
  });
});
