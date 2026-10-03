import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import {
  STATE_COOKIE_NAME,
  createNonce,
  encodeState,
  getStateCookieOptions,
  noncesMatch,
  parseState,
} from "./oauthState";
import { resolvePublicOrigin } from "./publicOrigin";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Read one cookie from the request.
 *
 * No `cookie-parser` is registered on this app — `sdk.ts` parses the header
 * itself with the same `cookie` package — so this does the same, rather than
 * adding middleware that other code would then quietly depend on.
 */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const value = parseCookieHeader(header)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Where the OAuth portal lives. Client and server read the same variable. */
function portalUrl(): string | undefined {
  return process.env.OAUTH_PORTAL_URL || process.env.VITE_OAUTH_PORTAL_URL || undefined;
}

export function registerOAuthRoutes(app: Express) {
  /**
   * Begin sign-in.
   *
   * The authorization request is built HERE rather than in the browser, because
   * the nonce that protects it has to live in a cookie the client cannot write.
   * The client just navigates to this path (`getLoginUrl()`).
   *
   * The redirect URI comes from configuration, never from the request — the same
   * reason the checkout return URL does. A redirect URI taken from `Origin`
   * would let a caller choose where the authorization code is delivered.
   */
  app.get("/api/oauth/start", (req: Request, res: Response) => {
    const portal = portalUrl();
    if (!portal) {
      console.error(
        "[OAuth] no portal URL configured; set OAUTH_PORTAL_URL (or VITE_OAUTH_PORTAL_URL).",
      );
      res.status(503).json({ error: "Sign-in is unavailable." });
      return;
    }

    let origin: string;
    try {
      origin = resolvePublicOrigin(req.headers.origin);
    } catch (error) {
      console.error(
        "[OAuth] no public origin configured:",
        error instanceof Error ? error.message : error,
      );
      res.status(503).json({ error: "Sign-in is unavailable." });
      return;
    }

    let url: URL;
    try {
      url = new URL(`${portal.replace(/\/+$/, "")}/app-auth`);
    } catch {
      console.error("[OAuth] portal URL is not a valid URL.");
      res.status(503).json({ error: "Sign-in is unavailable." });
      return;
    }

    const redirectUri = `${origin}/api/oauth/callback`;
    const nonce = createNonce();

    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", encodeState(redirectUri, nonce));
    url.searchParams.set("type", "signIn");

    res.cookie(STATE_COOKIE_NAME, nonce, getStateCookieOptions(req));
    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Verified BEFORE any token is exchanged. Exchanging first and checking
    // afterwards would still mint a session for whoever owns the code.
    const parsed = parseState(state);
    const expectedNonce = readCookie(req, STATE_COOKIE_NAME);

    // Single use: cleared whether this attempt succeeds or fails, so a captured
    // callback URL cannot be replayed against the same cookie.
    const clearOptions = getStateCookieOptions(req);
    res.clearCookie(STATE_COOKIE_NAME, { ...clearOptions, maxAge: -1 });

    if (!parsed || !expectedNonce || !noncesMatch(parsed.nonce, expectedNonce)) {
      // One message for all three cases on purpose. Distinguishing "no cookie"
      // from "wrong nonce" would tell an attacker which half of the check they
      // tripped. The detail is logged instead, without the values.
      console.warn(
        "[OAuth] callback rejected: state/nonce mismatch",
        JSON.stringify({
          stateStructured: Boolean(parsed),
          cookiePresent: Boolean(expectedNonce),
        }),
      );
      res
        .status(400)
        .json({ error: "Sign-in request could not be verified. Please try signing in again." });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_TTL_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
