export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Where to send the browser to begin sign-in.
 *
 * This used to build the OAuth portal URL in the browser, with
 * `state = btoa(redirectUri)` — a value identical for every user and every
 * sign-in, and so guessable by construction. The callback compared it to
 * nothing, which let an attacker replay their own authorization code into a
 * victim's browser and have the server mint a session for the attacker's
 * account on it.
 *
 * The authorization request is now built server-side by `/api/oauth/start`,
 * because the nonce that protects it must live in an httpOnly cookie the
 * client cannot write. The redirect URI is taken from server configuration
 * rather than `window.location.origin`, so a caller cannot choose where the
 * authorization code is delivered.
 *
 * Still synchronous, and still a plain top-level navigation target, so every
 * existing `window.location.href = getLoginUrl()` call site is unchanged.
 *
 * The "no OAuth configured" fallback is kept deliberately. `/api/oauth/start`
 * lives on the Express host; the Vercel deployment serves the static bundle plus
 * three webhook functions and has no `/api/oauth` function at all, so pointing
 * at it unconditionally would turn the previous graceful no-op into a 404 there.
 * Same condition as before — if no portal is configured, this is not an
 * OAuth-capable deployment.
 */
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  if (!oauthPortalUrl || oauthPortalUrl === "undefined") {
    return "/login";
  }
  return "/api/oauth/start";
};
