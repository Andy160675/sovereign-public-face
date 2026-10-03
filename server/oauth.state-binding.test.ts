import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import { HOST_COOKIE_NAME } from "../shared/const";
import {
  STATE_COOKIE_NAME,
  createNonce,
  decodeStateRedirectUri,
  encodeState,
  noncesMatch,
  parseState,
} from "./_core/oauthState";

/**
 * The attack these tests encode.
 *
 * The callback used to accept any `state` and compare it to nothing. `state` was
 * generated in the browser as `btoa(redirectUri)` — identical for every user and
 * every sign-in. So an attacker could begin their own sign-in, capture their own
 * authorization `code`, and induce a victim's browser to load
 * `/api/oauth/callback?code=<attacker code>&state=<the constant>`. The server
 * exchanged the attacker's code and set a session for the ATTACKER's account on
 * the VICTIM's browser.
 *
 * `exchangeCodeForToken` is mocked throughout: whether it is CALLED is the
 * assertion. A rejected callback must not reach the token exchange at all,
 * because exchanging first and checking afterwards still mints a session for
 * whoever owns the code.
 */

const exchangeCodeForToken = vi.fn();
const getUserInfo = vi.fn();
const createSessionToken = vi.fn();
const upsertUser = vi.fn();

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: (...args: unknown[]) => exchangeCodeForToken(...args),
    getUserInfo: (...args: unknown[]) => getUserInfo(...args),
    createSessionToken: (...args: unknown[]) => createSessionToken(...args),
  },
}));

vi.mock("./db", () => ({
  upsertUser: (...args: unknown[]) => upsertUser(...args),
}));

const { registerOAuthRoutes } = await import("./_core/oauth");

/** Drive the registered handler directly, without binding a port. */
async function callRoute(
  path: string,
  query: Record<string, string>,
  cookieHeader?: string,
): Promise<{ status: number; body: unknown; location?: string; setCookie: string[] }> {
  const app = express();
  registerOAuthRoutes(app);

  const layer = (app as any)._router.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.get,
  );
  if (!layer) throw new Error(`route not registered: ${path}`);

  const setCookie: string[] = [];
  let status = 200;
  let body: unknown;
  let location: string | undefined;

  const req: any = { query, headers: cookieHeader ? { cookie: cookieHeader } : {}, protocol: "https" };
  const res: any = {
    status(code: number) { status = code; return this; },
    json(payload: unknown) { body = payload; return this; },
    cookie(name: string, value: string) { setCookie.push(`${name}=${value}`); return this; },
    clearCookie(name: string) { setCookie.push(`${name}=; cleared`); return this; },
    redirect(code: number, to: string) { status = code; location = to; return this; },
  };

  await layer.route.stack[0].handle(req, res, () => {});
  return { status, body, location, setCookie };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUBLIC_BASE_URL = "https://sovereign.example";
  process.env.VITE_OAUTH_PORTAL_URL = "https://portal.example";
  process.env.NODE_ENV = "production";
});

afterEach(() => {
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.VITE_OAUTH_PORTAL_URL;
});

describe("the session-fixation attack is refused", () => {
  it("rejects an attacker's code carrying the OLD constant state, and never exchanges it", async () => {
    // Exactly what the previous client produced, and what an attacker could
    // therefore reproduce for any deployment.
    const legacyState = Buffer.from("https://sovereign.example/api/oauth/callback", "utf8").toString(
      "base64",
    );

    const result = await callRoute("/api/oauth/callback", {
      code: "attacker-authorization-code",
      state: legacyState,
    });

    expect(result.status).toBe(400);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects a well-formed state when the victim's browser holds no nonce cookie", async () => {
    const state = encodeState("https://sovereign.example/api/oauth/callback", createNonce());

    const result = await callRoute("/api/oauth/callback", { code: "attacker-code", state });

    expect(result.status).toBe(400);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("rejects when the attacker supplies their own nonce in state but the cookie is the victim's", async () => {
    const attackerNonce = createNonce();
    const victimNonce = createNonce();
    const state = encodeState("https://sovereign.example/api/oauth/callback", attackerNonce);

    const result = await callRoute(
      "/api/oauth/callback",
      { code: "attacker-code", state },
      `${STATE_COOKIE_NAME}=${victimNonce}`,
    );

    expect(result.status).toBe(400);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("does not reveal which half of the check failed", async () => {
    const noCookie = await callRoute("/api/oauth/callback", {
      code: "c",
      state: encodeState("https://sovereign.example/api/oauth/callback", createNonce()),
    });
    const wrongCookie = await callRoute(
      "/api/oauth/callback",
      { code: "c", state: encodeState("https://sovereign.example/api/oauth/callback", createNonce()) },
      `${STATE_COOKIE_NAME}=${createNonce()}`,
    );

    expect(noCookie.body).toEqual(wrongCookie.body);
    expect(noCookie.status).toBe(wrongCookie.status);
  });

  it("clears the nonce cookie even when it rejects, so a captured URL cannot be replayed", async () => {
    const result = await callRoute(
      "/api/oauth/callback",
      { code: "c", state: "not-a-state" },
      `${STATE_COOKIE_NAME}=${createNonce()}`,
    );

    expect(result.setCookie.some(c => c.startsWith(`${STATE_COOKIE_NAME}=;`))).toBe(true);
  });
});

describe("a genuine sign-in still completes", () => {
  it("accepts the callback when state and cookie agree, and exchanges the code", async () => {
    exchangeCodeForToken.mockResolvedValue({ accessToken: "at" });
    getUserInfo.mockResolvedValue({ openId: "user-1", name: "Real User", email: "a@b.example" });
    createSessionToken.mockResolvedValue("session-token");
    upsertUser.mockResolvedValue(undefined);

    const nonce = createNonce();
    const state = encodeState("https://sovereign.example/api/oauth/callback", nonce);

    const result = await callRoute(
      "/api/oauth/callback",
      { code: "genuine-code", state },
      `${STATE_COOKIE_NAME}=${nonce}`,
    );

    expect(exchangeCodeForToken).toHaveBeenCalledWith("genuine-code", state);
    expect(result.status).toBe(302);
    expect(result.location).toBe("/");
    // NODE_ENV is "production" here, so the session cookie carries the
    // `__Host-` prefix. Pinning the prefixed name rather than a bare substring:
    // `startsWith("app_session_id=")` would silently stop matching the moment
    // the prefix landed, which is exactly what it did.
    expect(result.setCookie.some(c => c.startsWith(`${HOST_COOKIE_NAME}=`))).toBe(true);
  });
});

describe("/api/oauth/start issues the nonce and builds the request server-side", () => {
  it("sets an httpOnly nonce cookie and redirects to the portal", async () => {
    const result = await callRoute("/api/oauth/start", {});

    expect(result.status).toBe(302);
    expect(result.setCookie.some(c => c.startsWith(`${STATE_COOKIE_NAME}=`))).toBe(true);

    const url = new URL(result.location!);
    expect(url.origin).toBe("https://portal.example");
    expect(url.pathname).toBe("/app-auth");
    // The redirect URI is OUR configured origin, not anything from the request.
    expect(url.searchParams.get("redirectUri")).toBe("https://sovereign.example/api/oauth/callback");

    const parsed = parseState(url.searchParams.get("state")!);
    expect(parsed?.redirectUri).toBe("https://sovereign.example/api/oauth/callback");
    expect(parsed?.nonce).toBeTruthy();
  });

  it("ignores a hostile Origin header when choosing the redirect URI", async () => {
    const app = express();
    registerOAuthRoutes(app);
    const layer = (app as any)._router.stack.find(
      (e: any) => e.route?.path === "/api/oauth/start",
    );

    let location = "";
    const req: any = { query: {}, headers: { origin: "https://evil.example" }, protocol: "https" };
    const res: any = {
      status() { return this; },
      json() { return this; },
      cookie() { return this; },
      clearCookie() { return this; },
      redirect(_code: number, to: string) { location = to; return this; },
    };
    await layer.route.stack[0].handle(req, res, () => {});

    expect(new URL(location).searchParams.get("redirectUri")).toBe(
      "https://sovereign.example/api/oauth/callback",
    );
  });

  it("issues a different nonce every time", async () => {
    const a = await callRoute("/api/oauth/start", {});
    const b = await callRoute("/api/oauth/start", {});
    expect(a.setCookie[0]).not.toBe(b.setCookie[0]);
  });

  it("fails closed, without redirecting, when no portal is configured", async () => {
    delete process.env.VITE_OAUTH_PORTAL_URL;
    const result = await callRoute("/api/oauth/start", {});
    expect(result.status).toBe(503);
    expect(result.location).toBeUndefined();
  });

  it("fails closed when no public origin is configured", async () => {
    delete process.env.PUBLIC_BASE_URL;
    const result = await callRoute("/api/oauth/start", {});
    expect(result.status).toBe(503);
    expect(result.location).toBeUndefined();
  });
});

describe("state encoding", () => {
  it("round-trips the redirect URI and nonce", () => {
    const nonce = createNonce();
    const parsed = parseState(encodeState("https://a.example/cb", nonce));
    expect(parsed).toEqual({ redirectUri: "https://a.example/cb", nonce });
  });

  it("keeps the redirect URI recoverable for the token exchange", () => {
    const state = encodeState("https://a.example/cb", createNonce());
    expect(decodeStateRedirectUri(state)).toBe("https://a.example/cb");
  });

  it("still recovers a legacy plain-base64 redirect URI, so in-flight sign-ins can exchange", () => {
    const legacy = Buffer.from("https://a.example/cb", "utf8").toString("base64");
    expect(decodeStateRedirectUri(legacy)).toBe("https://a.example/cb");
  });

  it("treats a legacy state as unverifiable, which is what makes the callback reject it", () => {
    const legacy = Buffer.from("https://a.example/cb", "utf8").toString("base64");
    expect(parseState(legacy)).toBeNull();
  });

  it("rejects malformed, empty and partial states", () => {
    expect(parseState("")).toBeNull();
    expect(parseState("@@@not-base64@@@")).toBeNull();
    expect(parseState(Buffer.from("{}", "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from('{"r":"x"}', "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from('{"n":"x"}', "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from('{"r":"","n":"x"}', "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from('{"r":"x","n":""}', "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from('["r","n"]', "utf8").toString("base64url"))).toBeNull();
    expect(parseState(Buffer.from("null", "utf8").toString("base64url"))).toBeNull();
  });

  it("produces a nonce with real entropy and no collisions across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(createNonce());
    expect(seen.size).toBe(500);
    expect(createNonce().length).toBeGreaterThanOrEqual(32);
  });
});

describe("noncesMatch", () => {
  it("matches identical values and rejects differing ones", () => {
    const nonce = createNonce();
    expect(noncesMatch(nonce, nonce)).toBe(true);
    expect(noncesMatch(nonce, createNonce())).toBe(false);
  });

  it("returns false rather than throwing on a length mismatch", () => {
    // timingSafeEqual throws when lengths differ; that must not become a 500.
    expect(() => noncesMatch("short", "considerably-longer-value")).not.toThrow();
    expect(noncesMatch("short", "considerably-longer-value")).toBe(false);
  });

  it("rejects an empty value against a real nonce", () => {
    expect(noncesMatch("", createNonce())).toBe(false);
  });

  it("compares bytes, not characters, so multi-byte values of equal length differ", () => {
    expect(noncesMatch("é", "e")).toBe(false);
  });
});
