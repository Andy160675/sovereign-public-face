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

  it("pin path: receiptRuntime loads without @codex-sovereign/jarus package require", () => {
    expect(typeof receiptRuntime().verifyChain).toBe("function");
    expect(typeof receiptRuntime().ReceiptEngine).toBe("function");
  });
});
