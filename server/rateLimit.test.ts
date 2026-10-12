import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * What these tests are actually defending.
 *
 * Before this change nothing on the Express host counted requests at all:
 * `/api/oauth/start`, the OAuth callback and every tRPC procedure — including
 * `checkout.createSession`, which creates a real Stripe object — could be called
 * without limit. The two things most worth pinning are therefore:
 *
 *  1. that an over-budget caller is actually refused, and
 *  2. that a broken or unreachable limiter does NOT refuse anybody.
 *
 * (2) matters more than it looks. A rate limiter is a mitigation, not an
 * authentication control; if it fails closed, a Redis blip takes the whole site
 * down, which is a worse outcome than a brief unthrottled window. Every test
 * below that asserts `next()` was called is holding that line.
 *
 * No network: the Upstash module is mocked, so nothing here needs credentials
 * and nothing reaches out. The real client is exercised only by configuration —
 * which is the part a test can get wrong without noticing.
 */

const limitMock = vi.fn();
const redisCtor = vi.fn();
const slidingWindow = vi.fn((requests: number, window: string) => ({
  kind: "sliding",
  requests,
  window,
}));
const ratelimitCtor = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(config: unknown) {
      redisCtor(config);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = slidingWindow;
    constructor(config: unknown) {
      ratelimitCtor(config);
    }
    limit(key: string) {
      return limitMock(key);
    }
  }
  return { Ratelimit };
});

type Core = typeof import("./rateLimit.mjs");
type Middleware = typeof import("./_core/rateLimit");

let core: Core;
let middleware: Middleware;

const ORIGINAL_ENV = { ...process.env };

async function load() {
  vi.resetModules();
  core = await import("./rateLimit.mjs");
  middleware = await import("./_core/rateLimit");
  core.resetRateLimitStateForTests();
}

beforeEach(async () => {
  limitMock.mockReset();
  redisCtor.mockReset();
  ratelimitCtor.mockReset();
  slidingWindow.mockClear();
  process.env.UPSTASH_REDIS_REST_URL = "https://fixture.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fixture-token";
  delete process.env.VERCEL;
  process.env.NODE_ENV = "production";
  await load();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function fakeRequest(opts: {
  remoteAddress?: string;
  headers?: Record<string, string>;
} = {}): Request {
  return {
    headers: opts.headers ?? {},
    socket: { remoteAddress: opts.remoteAddress ?? "198.51.100.7" },
  } as unknown as Request;
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return { res: res as unknown as Response, headers, raw: res };
}

/** Run the middleware and settle the promise chain inside it. */
async function run(handler: ReturnType<Middleware["rateLimit"]>, req: Request) {
  const next = vi.fn();
  const { res, headers, raw } = fakeResponse();
  handler(req, res, next);
  await vi.waitFor(() => {
    if (next.mock.calls.length === 0 && raw.statusCode === 200) {
      throw new Error("middleware has not settled");
    }
  });
  return { next, headers, raw };
}

describe("an over-budget caller is refused", () => {
  it("answers 429 and does not run the route", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 42_000 });

    const { next, headers, raw } = await run(
      middleware.rateLimit("oauth", core.OAUTH_LIMIT),
      fakeRequest(),
    );

    expect(next).not.toHaveBeenCalled();
    expect(raw.statusCode).toBe(429);
    expect(headers["retry-after"]).toBe("42");
  });

  it("never discloses the budget, the window or the remaining count", async () => {
    // Leaking those tells an attacker exactly how to pace a slower attempt.
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 1_000 });

    const { raw } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    const body = JSON.stringify(raw.body);
    expect(body).not.toMatch(/\d/);
    expect(body).not.toMatch(/limit|window|remaining|reset/i);
  });

  it("rounds Retry-After up, so it is never 0 seconds", async () => {
    // A 0 would invite an immediate retry that is certain to fail again.
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 10 });

    const { headers } = await run(
      middleware.rateLimit("oauth", core.OAUTH_LIMIT),
      fakeRequest(),
    );

    expect(Number(headers["retry-after"])).toBeGreaterThanOrEqual(1);
  });

  it("stays at least 1 even when the window has already elapsed", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() - 60_000 });

    const { headers } = await run(
      middleware.rateLimit("oauth", core.OAUTH_LIMIT),
      fakeRequest(),
    );

    expect(headers["retry-after"]).toBe("1");
  });
});

describe("a within-budget caller is unaffected", () => {
  it("calls next() and writes no status", async () => {
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 1_000 });

    const { next, raw } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(raw.statusCode).toBe(200);
  });
});

describe("failing open — the property that keeps a Redis blip from taking the site down", () => {
  it("allows the request when the store rejects", async () => {
    limitMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:443"));

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { next, raw } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(raw.statusCode).toBe(200);
    // Silent degradation would mean nobody ever learns the limiter stopped
    // working, so the log line is part of the contract, not decoration.
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("allows the request when the limiter throws synchronously", async () => {
    limitMock.mockImplementation(() => {
      throw new Error("boom");
    });

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { next } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    expect(next).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it("does not leak the store's error text to the caller", async () => {
    // An Upstash error can carry the endpoint host; a 500 body is not the place.
    limitMock.mockRejectedValue(new Error("https://fixture.upstash.io refused"));

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { raw } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    expect(JSON.stringify(raw.body ?? "")).not.toContain("upstash.io");
    errors.mockRestore();
  });
});

describe("unconfigured is a loud no-op, not a crash", () => {
  beforeEach(async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await load();
  });

  it("serves every request and never constructs a client", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { next } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest(),
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(redisCtor).not.toHaveBeenCalled();
    expect(limitMock).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("says so in production, because a silently disabled control is the worst case", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    core.isRateLimitConfigured();

    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toMatch(/NOT being rate limited/i);
    errors.mockRestore();
  });

  it("reports itself as unconfigured rather than pretending", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(core.isRateLimitConfigured()).toBe(false);
    errors.mockRestore();
  });

  it("stays quiet in development, where no credentials is the normal case", async () => {
    process.env.NODE_ENV = "development";
    await load();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    core.isRateLimitConfigured();

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("warns once, not once per request", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      await run(middleware.rateLimit("trpc", core.API_LIMIT), fakeRequest());
    }

    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});

describe("the bucket key cannot be chosen by the caller", () => {
  it("ignores x-forwarded-for off the platform, using the socket address", async () => {
    // Trusting it would let an attacker both evade their own budget and exhaust
    // a victim's by forging the victim's address.
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "198.51.100.7",
        headers: { "x-forwarded-for": "203.0.113.1" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("198.51.100.7");
  });

  it("ignores x-vercel-forwarded-for when not running on Vercel", async () => {
    // Off-platform that header is just another client-settable string.
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "198.51.100.7",
        headers: { "x-vercel-forwarded-for": "203.0.113.1" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("198.51.100.7");
  });

  it("uses the platform header on Vercel, where the platform overwrites it", async () => {
    process.env.VERCEL = "1";
    await load();
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "203.0.113.250",
        headers: { "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("falls back to the socket address when the platform header is absent", async () => {
    process.env.VERCEL = "1";
    await load();
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({ remoteAddress: "198.51.100.7" }),
    );

    expect(limitMock).toHaveBeenCalledWith("198.51.100.7");
  });

  it("does not crash on a request with no socket", async () => {
    // A 500 here would be a self-inflicted outage on an unusual transport.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(core.clientKey({ headers: {} })).toBeNull();
    expect(core.clientKey(undefined)).toBeNull();
    errors.mockRestore();
  });
});

describe("behind a reverse proxy — the case that would have throttled the whole site", () => {
  /**
   * The Express host is not on Vercel: vercel.json routes only the static bundle
   * and three api/* functions, so /api/trpc and /api/oauth are served by the
   * long-running host behind an edge. Keying on the socket address there gives
   * every client the SAME key, so one bucket meters all traffic and a 120/min
   * budget takes the site down under ordinary use.
   *
   * These pin the safe behaviour: refuse to meter rather than meter everyone
   * together, and use the forwarded chain only when the operator has said how
   * many hops to trust.
   */
  it("does not meter at all when every request arrives from a proxy address", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { next, raw } = await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );

    // Served, not 429 — and crucially no shared bucket was consumed.
    expect(next).toHaveBeenCalledTimes(1);
    expect(raw.statusCode).toBe(200);
    expect(limitMock).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("says which variable turns per-caller limits on, instead of degrading silently", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    core.clientKey({ headers: {}, socket: { remoteAddress: "10.0.0.5" } });

    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toContain("RATE_LIMIT_TRUSTED_PROXIES");
    errors.mockRestore();
  });

  it("warns once, not once per request", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      core.clientKey({ headers: {}, socket: { remoteAddress: "127.0.0.1" } });
    }

    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it.each([
    ["::1", "IPv6 loopback"],
    ["127.0.0.1", "IPv4 loopback"],
    ["::ffff:10.0.0.5", "IPv4-mapped IPv6 private"],
    ["10.1.2.3", "RFC1918 /8"],
    ["172.16.0.1", "RFC1918 /12 lower bound"],
    ["172.31.255.254", "RFC1918 /12 upper bound"],
    ["192.168.1.1", "RFC1918 /16"],
    ["169.254.1.1", "link-local"],
    ["fd00::1", "IPv6 unique-local"],
    ["fe80::1", "IPv6 link-local"],
    ["", "empty"],
  ])("treats %s (%s) as infrastructure, not a caller", (address: string) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    core.resetRateLimitStateForTests();
    expect(
      core.clientKey({ headers: {}, socket: { remoteAddress: address } }),
    ).toBeNull();
    errors.mockRestore();
  });

  it.each([
    ["203.0.113.9", "public IPv4"],
    ["172.15.0.1", "just below the RFC1918 /12 range"],
    ["172.32.0.1", "just above the RFC1918 /12 range"],
    ["2001:db8::1", "public IPv6"],
  ])("meters %s (%s) directly, with no proxy config needed", async (address: string) => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({ remoteAddress: address }),
    );

    expect(limitMock).toHaveBeenCalledWith(address);
  });
});

describe("RATE_LIMIT_TRUSTED_PROXIES counts hops from the right, so prepended entries are ignored", () => {
  beforeEach(async () => {
    process.env.RATE_LIMIT_TRUSTED_PROXIES = "1";
    await load();
    limitMock.mockResolvedValue({ success: true, reset: 0 });
  });

  it("uses the address the one trusted proxy observed", async () => {
    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("ignores an address the client prepended to evade its budget", async () => {
    // The attacker sends X-Forwarded-For: 1.2.3.4; the proxy APPENDS what it
    // saw, so the real address is last and the forged one is to its left.
    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("cannot be used to exhaust a victim's bucket by naming their address", async () => {
    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "198.51.100.77, 198.51.100.77, 203.0.113.9" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
    expect(limitMock).not.toHaveBeenCalledWith("198.51.100.77");
  });

  it("counts two hops from the right when two are configured", async () => {
    process.env.RATE_LIMIT_TRUSTED_PROXIES = "2";
    await load();
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.9" },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });

  it("does not meter when the chain is shorter than the configured hops", async () => {
    // A short chain means the request did not come through the expected proxies,
    // so nothing in it can be trusted as a caller identity.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.RATE_LIMIT_TRUSTED_PROXIES = "3";
    await load();

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );

    expect(limitMock).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("ignores a non-numeric or zero setting rather than guessing", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const value of ["0", "-1", "yes", ""]) {
      process.env.RATE_LIMIT_TRUSTED_PROXIES = value;
      await load();
      expect(
        core.clientKey({
          headers: { "x-forwarded-for": "203.0.113.9" },
          socket: { remoteAddress: "10.0.0.5" },
        }),
        `setting "${value}" was trusted`,
      ).toBeNull();
    }
    errors.mockRestore();
  });

  it("still prefers the platform header on Vercel, ignoring the setting", async () => {
    process.env.VERCEL = "1";
    await load();
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(
      middleware.rateLimit("trpc", core.API_LIMIT),
      fakeRequest({
        remoteAddress: "10.0.0.5",
        headers: {
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-forwarded-for": "1.2.3.4, 198.51.100.1",
        },
      }),
    );

    expect(limitMock).toHaveBeenCalledWith("203.0.113.9");
  });
});

describe("the budgets and window are what the surfaces need", () => {
  it("keeps separate buckets per surface, so page loads cannot drain sign-in", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(middleware.rateLimit("oauth", core.OAUTH_LIMIT), fakeRequest());
    await run(middleware.rateLimit("trpc", core.API_LIMIT), fakeRequest());

    const prefixes = ratelimitCtor.mock.calls.map(
      ([config]: [{ prefix: string }]) => config.prefix,
    );
    expect(prefixes).toEqual(["ratelimit:oauth", "ratelimit:trpc"]);
  });

  it("builds one limiter per surface and reuses it", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    for (let i = 0; i < 4; i++) {
      await run(middleware.rateLimit("trpc", core.API_LIMIT), fakeRequest());
    }

    expect(ratelimitCtor).toHaveBeenCalledTimes(1);
    expect(redisCtor).toHaveBeenCalledTimes(1);
  });

  it("uses a sliding window, not a fixed one", async () => {
    // A fixed window lets twice the budget through either side of a boundary,
    // which is exactly when a burst arrives.
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(middleware.rateLimit("trpc", core.API_LIMIT), fakeRequest());

    expect(slidingWindow).toHaveBeenCalledWith(core.API_LIMIT, core.WINDOW);
  });

  it("keeps sign-in tighter than ordinary browsing", async () => {
    expect(core.OAUTH_LIMIT).toBeLessThan(core.API_LIMIT);
  });

  it("leaves the tRPC budget above a realistic page load", async () => {
    // The client issues several queries per navigation; a budget near that would
    // throttle customers rather than attackers.
    expect(core.API_LIMIT).toBeGreaterThanOrEqual(60);
  });

  it("does not send Upstash analytics, which would bill per request", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });

    await run(middleware.rateLimit("trpc", core.API_LIMIT), fakeRequest());

    expect(ratelimitCtor.mock.calls[0][0]).toMatchObject({ analytics: false });
  });
});
