import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Where the limiter actually sits in the request pipeline.
 *
 * `server/rateLimit.test.ts` proves the middleware's behaviour in isolation.
 * This file proves the thing that isolation cannot: that it is mounted on the
 * paths that needed it and NOT on the Stripe webhook.
 *
 * The webhook exclusion is load-bearing and easy to get wrong later. Stripe
 * retries a delivery it did not get a 2xx for; a 429 would therefore discard
 * legitimate payment events — real damage — while buying nothing, because the
 * webhook's control is signature verification over raw bytes and an attacker
 * cannot forge a signature anyway. The exclusion is structural rather than a
 * path match: `createStripeWebhookApp()` registers the webhook route BEFORE
 * `server/_core/index.ts` adds any middleware, so a delivery is answered before
 * the limiter is reached. A test is the only thing that will notice if someone
 * later moves `app.use(rateLimit(...))` above that registration.
 */

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = (requests: number) => ({ requests });
    limit(key: string) {
      return limitMock(key);
    }
  }
  return { Ratelimit };
});

type Middleware = typeof import("./_core/rateLimit");
let middleware: Middleware;

const ORIGINAL_ENV = { ...process.env };

/**
 * The same assembly order as `server/_core/index.ts`: the webhook route is
 * registered by the factory first, then security headers, then the limiters,
 * then the body parser and the real routes.
 */
async function buildApp() {
  const app = express();

  // Stands in for registerStripeWebhook: registered FIRST, exactly as
  // createStripeWebhookApp() does it.
  app.post("/api/stripe/webhook", (_req, res) => {
    res.status(200).json({ received: true });
  });

  app.use("/api/oauth", middleware.rateLimit("oauth", middleware.OAUTH_LIMIT));
  app.use("/api/trpc", middleware.rateLimit("trpc", middleware.API_LIMIT));

  app.use(express.json());
  app.get("/api/oauth/start", (_req, res) => res.status(302).set("location", "/x").end());
  app.get("/api/oauth/callback", (_req, res) => res.status(200).json({ ok: true }));
  app.all("/api/trpc/*", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/assets/app.js", (_req, res) => res.status(200).type("js").send("//"));
  app.get("/", (_req, res) => res.status(200).type("html").send("<!doctype html>"));

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    /** A caller the limiter can attribute, via the one trusted hop. */
    caller: { "x-forwarded-for": "203.0.113.9" } as Record<string, string>,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  limitMock.mockReset();
  process.env.UPSTASH_REDIS_REST_URL = "https://fixture.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fixture-token";
  // Configured the way the real host must be: these tests talk to a loopback
  // server, so without this the socket address is infrastructure and nothing is
  // metered at all — which is the correct safe default, and would make every
  // assertion below vacuous. One trusted hop plus an X-Forwarded-For on each
  // request is exactly the deployment shape the limiter is meant for.
  process.env.RATE_LIMIT_TRUSTED_PROXIES = "1";
  delete process.env.VERCEL;
  vi.resetModules();
  const core = await import("./rateLimit.mjs");
  middleware = await import("./_core/rateLimit");
  core.resetRateLimitStateForTests();
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
  process.env = { ...ORIGINAL_ENV };
});

describe("the Stripe webhook is never rate limited", () => {
  it("answers a delivery without consuming any budget", async () => {
    // If this ever fails, Stripe retries are being dropped.
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const response = await fetch(`${app.base}/api/stripe/webhook`, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef", ...app.caller },
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("stays unlimited across a burst, which is what a retry storm looks like", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    for (let i = 0; i < 25; i++) {
      const response = await fetch(`${app.base}/api/stripe/webhook`, {
        method: "POST",
        headers: app.caller,
        body: "{}",
      });
      expect(response.status).toBe(200);
    }
    expect(limitMock).not.toHaveBeenCalled();
  });
});

describe("the surfaces that had no limit now have one", () => {
  it("limits GET /api/oauth/start", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });

    const response = await fetch(`${app.base}/api/oauth/start`, {
      redirect: "manual",
      headers: app.caller,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    // A cached 429 would be served to callers well within budget.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("limits the OAuth callback, which is the credential-bearing one", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 5_000 });

    const response = await fetch(`${app.base}/api/oauth/callback?code=x&state=y`, {
      headers: app.caller,
    });

    expect(response.status).toBe(429);
  });

  it("limits tRPC, including checkout.createSession", async () => {
    // Unlimited, this one creates a real Stripe Checkout Session per call.
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 5_000 });

    const response = await fetch(`${app.base}/api/trpc/checkout.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json", ...app.caller },
      body: JSON.stringify({ productId: "x" }),
    });

    expect(response.status).toBe(429);
  });

  it("serves them normally while within budget", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    expect((await fetch(`${app.base}/api/trpc/auth.me`, { headers: app.caller })).status).toBe(200);
    expect(
      (
        await fetch(`${app.base}/api/oauth/callback`, {
          redirect: "manual",
          headers: app.caller,
        })
      ).status,
    ).toBe(200);
    expect(limitMock).toHaveBeenCalledTimes(2);
    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("keeps the two budgets in separate buckets", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await fetch(`${app.base}/api/trpc/auth.me`, { headers: app.caller });
    await fetch(`${app.base}/api/oauth/callback`, {
      redirect: "manual",
      headers: app.caller,
    });

    // Two surfaces, two limiter instances — a page-load burst cannot drain the
    // sign-in allowance. The prefixes themselves are asserted in rateLimit.test.ts.
    expect(limitMock).toHaveBeenCalledTimes(2);
  });
});

describe("the static bundle is deliberately not limited", () => {
  it("serves assets without consuming budget", async () => {
    // One page load pulls many files, so an API-sized budget here would throttle
    // customers rather than abuse — and in production this bundle is served by
    // the CDN in vercel.json, not by this host. Recorded so the omission reads
    // as a decision rather than an oversight.
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    expect(
      (await fetch(`${app.base}/assets/app.js`, { headers: app.caller })).status,
    ).toBe(200);
    expect((await fetch(`${app.base}/`, { headers: app.caller })).status).toBe(200);
    expect(limitMock).not.toHaveBeenCalled();
  });
});

describe("the real server/_core/index.ts has the order these tests assume", () => {
  /**
   * Everything above builds a replica of the host's middleware order. A replica
   * proves the order is sound; it cannot prove the real file still has it. This
   * reads the actual source so that moving `app.use(rateLimit(...))` above the
   * webhook registration fails here instead of silently discarding Stripe
   * retries in production.
   */
  it("registers the webhook app before any rate limiter", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("./_core/index.ts", import.meta.url),
      "utf8",
    );

    const webhookAt = source.indexOf("createStripeWebhookApp()");
    const oauthAt = source.indexOf('rateLimit("oauth"');
    const trpcAt = source.indexOf('rateLimit("trpc"');

    expect(webhookAt).toBeGreaterThan(-1);
    expect(oauthAt).toBeGreaterThan(-1);
    expect(trpcAt).toBeGreaterThan(-1);
    expect(webhookAt).toBeLessThan(oauthAt);
    expect(webhookAt).toBeLessThan(trpcAt);
  });

  it("mounts both limiters on their paths", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("./_core/index.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('app.use("/api/oauth", rateLimit("oauth"');
    expect(source).toContain('app.use("/api/trpc", rateLimit("trpc"');
  });

  it("limits before the 50mb body parser, not after", async () => {
    // Otherwise an abusive caller is handed a 50mb parse budget first, which is
    // the cheapest denial-of-service this app offers.
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("./_core/index.ts", import.meta.url),
      "utf8",
    );

    expect(source.indexOf('rateLimit("trpc"')).toBeLessThan(
      source.indexOf('express.json({ limit: "50mb" })'),
    );
  });
});
