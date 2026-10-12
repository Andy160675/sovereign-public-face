/** Synthetic HTTP boundary regressions; never contacts Stripe or a database. */
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, request, type Server, type ClientRequest, type IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { createMemoryReceiptJournal } from "./stripe-receipt-store";
import { registerStripeWebhook, type StripeWebhookOptions } from "./stripe-webhook";

const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const secret = "whsec_ingress_synthetic_fixture";
const payload = JSON.stringify({
  id: "evt_ingress", object: "event", type: "checkout.session.completed",
  livemode: false, data: { object: { amount_total: 100, currency: "gbp" } },
});
const signed = (body = payload, timestamp?: number) =>
  Stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp });

let server: Server | undefined;
async function boot(options: StripeWebhookOptions = {}, parseFirst = false) {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_ingress_synthetic_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  const journal = createMemoryReceiptJournal();
  let writes = 0;
  const app = express();
  if (parseFirst) app.use(express.json());
  registerStripeWebhook(app, {
    connectorId: "stripe:ingress:test", mode: "test", ...options,
    journal: {
      async transact(connector, run) {
        writes++;
        return journal.transact(connector, run);
      },
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("address");
  const url = `http://127.0.0.1:${address.port}/api/stripe/webhook`;
  async function post(signature: string | null = signed(), body: string | Buffer = payload, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
      method: "POST", headers: {
        "content-type": "application/json",
        ...(signature === null ? {} : { "stripe-signature": signature }), ...headers,
      }, body,
    });
    return response;
  }
  return { journal, post, url, writes: () => writes };
}

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  vi.unstubAllEnvs();
});

describe("Stripe webhook authentication and bounded ingress", () => {
  it.each([
    ["missing", null], ["forged", "t=1,v1=forged"], ["expired", signed(payload, 1)],
  ])("%s signatures never open a durable transaction", async (_name, signature) => {
    const { post, journal, writes } = await boot();
    expect((await post(signature)).status).toBe(400);
    expect(writes()).toBe(0);
    expect(journal.chain).toHaveLength(0);
    expect(journal.events.size).toBe(0);
  });

  it("an unavailable journal does not turn forged traffic into storage faults", async () => {
    const { post, journal, writes } = await boot();
    journal.state.failKind = "stripe.delivery";
    expect((await post("t=1,v1=forged")).status).toBe(400);
    expect(writes()).toBe(0);
  });

  it.each([undefined, "", "TEST", "prod", " live "])("mode %s fails closed before writes", async (mode) => {
    vi.stubEnv("STRIPE_RECEIPT_MODE", mode);
    const { post, journal, writes } = await boot({ mode: undefined });
    expect((await post()).status).toBe(503);
    expect(writes()).toBe(0);
    expect(journal.chain).toHaveLength(0);
  });

  it.each(["test", "live"] as const)("explicit %s mode keeps scope enforcement", async (mode) => {
    const { post, journal } = await boot({ mode });
    const response = await post();
    expect(response.status).toBe(200);
    expect((await response.json()).disposition).toBe(mode === "test" ? "recorded" : "held");
    expect(journal.chain[0].kind).toBe("stripe.delivery");
    expect(journal.chain[1].payload).toMatchObject({ verified: true });
  });

  it.each(["test", "live"] as const)("accepts exact %s mode from environment", async (mode) => {
    vi.stubEnv("STRIPE_RECEIPT_MODE", mode);
    const { post } = await boot({ mode: undefined });
    const response = await post();
    expect(response.status).toBe(200);
    expect((await response.json()).disposition).toBe(mode === "test" ? "recorded" : "held");
  });

  it("bounds unfinished raw requests across windows and releases aborted capacity", async () => {
    let now = 1000;
    const { post, url, writes } = await boot({ admissionClock: () => now });
    const held: { client: ClientRequest; incoming: IncomingMessage }[] = [];
    try {
      for (let index = 0; index < 8; index++) {
        const accepted = new Promise<IncomingMessage>((resolve) => server!.once("request", resolve));
        const client = request(url, { method: "POST", headers: {
          "content-type": "application/json", "content-length": "1024",
          "stripe-signature": "t=1,v1=forged",
        } });
        client.on("error", () => {});
        client.flushHeaders();
        held.push({ client, incoming: await accepted });
      }
      // A fresh rate window must not permit unbounded pending body readers.
      now += 60_000;
      const blocked = await post();
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBe("1");
      expect(writes()).toBe(0);
      const aborted = new Promise<void>((resolve) => held[0].incoming.once("close", () => resolve()));
      held[0].client.destroy();
      await aborted;
      expect((await post()).status).toBe(200);
    } finally {
      for (const entry of held) entry.client.destroy();
    }
  });

  it("missing signing secret fails closed without durable attacker evidence", async () => {
    const { post, writes } = await boot({ webhookSecret: () => undefined });
    expect((await post()).status).toBe(503);
    expect(writes()).toBe(0);
  });

  it("missing SDK key fails closed before writes", async () => {
    const { post, writes } = await boot();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await post()).status).toBe(503);
    expect(writes()).toBe(0);
  });

  it("connector-wide admission bounds a burst despite attacker-controlled forwarding identities", async () => {
    let now = 1000;
    const { post, writes } = await boot({ admissionClock: () => now });
    for (let index = 0; index < 120; index++) {
      expect((await post("t=1,v1=forged", payload, { "x-forwarded-for": `192.0.2.${index}` })).status).toBe(400);
    }
    // Admission must reject before the raw parser would emit an oversized-body 413.
    const limited = await post("t=1,v1=forged", "x".repeat(110_000));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(writes()).toBe(0);
    now -= 1000;
    expect((await post()).status).toBe(429);
    now += 61_000;
    expect((await post()).status).toBe(200);
    expect(writes()).toBe(2);
  });

  it("rejects compressed bodies before signature verification or journal writes", async () => {
    const { post, writes } = await boot();
    expect((await post(signed(), gzipSync(payload), { "content-encoding": "gzip" })).status).toBe(415);
    expect(writes()).toBe(0);
  });

  it("rejects an upstream JSON parser instead of reserializing signed input", async () => {
    const { post, writes } = await boot({}, true);
    expect((await post()).status).toBe(400);
    expect(writes()).toBe(0);
  });

  it("limits raw request bodies before journal writes", async () => {
    const { post, writes } = await boot();
    const large = JSON.stringify({ ...JSON.parse(payload), padding: "x".repeat(110_000) });
    expect((await post(signed(large), large)).status).toBe(413);
    expect(writes()).toBe(0);
  });
});
