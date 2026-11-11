import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request } from "express";
import { usesHostPrefix } from "./cookies";

/**
 * CSRF binding for the OAuth authorization code flow.
 *
 * The callback used to accept whatever `state` it was given and never compare it
 * to anything the server issued. `state` was generated on the client as a
 * constant — `btoa(redirectUri)` — so it was identical for every user and every
 * sign-in, and therefore guessable by construction.
 *
 * That made this possible: an attacker starts a sign-in, captures their own
 * authorization `code`, then induces the victim's browser to load
 * `/api/oauth/callback?code=<attacker code>&state=<the constant>`. The server
 * exchanges the attacker's code, mints a session for the ATTACKER's openId, and
 * sets it on the VICTIM's browser. The victim then transacts under the
 * attacker's account — `checkout.createSession` writes
 * `client_reference_id: ctx.user.id` and `customer_email: ctx.user.email`, so
 * the victim can pay into the attacker's record.
 *
 * `sameSite: "lax"` gives no protection here, and for exactly the reason the
 * session cookie relies on: the callback is a top-level GET navigation, which
 * Lax permits.
 *
 * The fix is the standard one. The server issues a single-use random nonce,
 * stores it in an httpOnly cookie, and carries it inside `state`. On return,
 * both must be present and equal. An attacker can choose the `state` in a URL
 * they craft. HttpOnly alone does not stop a sibling host from planting a
 * Domain cookie with the same name. The __Host- prefix also requires Secure,
 * Path=/ and no Domain, so the browser rejects a sibling's injected nonce.
 * Plain-HTTP local development retains a separate unprefixed cookie.
 *
 * ## Why `state` is structured rather than just the nonce
 *
 * `state` is already load-bearing: `OAuthService.getTokenByCode` passes
 * `decodeState(state)` as `redirectUri` in the token exchange, and the OAuth
 * server rejects a redirect URI that does not match the one the authorization
 * request used. So the redirect URI has to survive the round trip. `state` now
 * carries both, and `decodeStateRedirectUri` is what the SDK uses to recover the
 * URI.
 */

/** Name of the short-lived cookie holding the nonce. */
export const STATE_COOKIE_NAME = "__Host-oauth_state";
const LOCAL_STATE_COOKIE_NAME = "oauth_state";

/** No legacy fallback on TLS/production: a sibling can plant an unprefixed cookie. */
export function getStateCookie(req: Request): { name: string; options: CookieOptions } {
  return {
    name: usesHostPrefix(req) ? STATE_COOKIE_NAME : LOCAL_STATE_COOKIE_NAME,
    options: getStateCookieOptions(req),
  };
}

/** Ten minutes is ample for a sign-in and short enough to limit replay. */
export const STATE_TTL_MS = 10 * 60 * 1000;

type ParsedState = { redirectUri: string; nonce: string };

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** A fresh nonce. 32 bytes of CSPRNG output; base64url so it is URL-safe. */
export function createNonce(): string {
  return randomBytes(32).toString("base64url");
}

/** Build the `state` parameter carrying both the redirect URI and the nonce. */
export function encodeState(redirectUri: string, nonce: string): string {
  return base64UrlEncode(JSON.stringify({ r: redirectUri, n: nonce }));
}

/**
 * Parse a structured `state`. Returns null for anything that is not one —
 * including the legacy plain-base64 redirect URI — so the caller can fail
 * closed rather than treat an unverifiable state as acceptable.
 */
export function parseState(state: string): ParsedState | null {
  const decoded = base64UrlDecode(state);
  if (!decoded) return null;

  let value: unknown;
  try {
    value = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const { r, n } = value as Record<string, unknown>;
  if (typeof r !== "string" || r.length === 0) return null;
  if (typeof n !== "string" || n.length === 0) return null;

  return { redirectUri: r, nonce: n };
}

/**
 * Recover the redirect URI for the token exchange.
 *
 * Tolerant on purpose: a structured state yields its `r`, and anything else
 * falls back to the legacy `atob(state)` form so an in-flight sign-in started
 * against the previous build still completes its exchange. Tolerance here is
 * safe because it decides only which redirect URI to send; whether the request
 * is trusted is decided separately, by the nonce comparison, which is NOT
 * tolerant.
 */
export function decodeStateRedirectUri(state: string): string {
  const parsed = parseState(state);
  if (parsed) return parsed.redirectUri;

  const legacy = base64UrlDecode(state);
  return legacy ?? "";
}

/**
 * Constant-time comparison. `timingSafeEqual` throws on a length mismatch, so
 * the lengths are checked first — and compared as bytes, because two strings of
 * equal character length can differ in byte length.
 */
export function noncesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Cookie options for the nonce.
 *
 * `sameSite: "lax"` is required rather than preferred: the browser arrives at
 * the callback by a cross-site top-level navigation from the OAuth portal, and
 * `strict` would withhold the cookie on exactly that request, breaking every
 * sign-in. Lax sends it, which is what makes the comparison possible.
 *
 * Path=/ and no Domain are mandatory for the __Host- prefix. The server only
 * consumes this cookie on the OAuth callback. Secure/name selection uses the
 * same predicate as the session cookie.
 */
export function getStateCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: usesHostPrefix(req),
    maxAge: STATE_TTL_MS,
  };
}
