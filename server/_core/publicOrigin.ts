/**
 * This deployment's own public origin, read from configuration and never from
 * the request.
 *
 * Two flows need it — the Stripe checkout return URL and the OAuth redirect URI
 * — and both are places where trusting `Origin`/`Referer` hands an attacker the
 * destination. Keeping one implementation is the point: `api/promotion-fix.js`
 * and the old checkout code each had their own notion of the same env var and
 * disagreed about it (one normalised trailing slashes, the other did not), which
 * is how a control ends up weaker in one path than the other.
 */

/**
 * A configured origin is only usable if it really is a bare origin.
 *
 * `server/promotion-fix-service.mjs` rejects a configured value outright unless
 * it is https with no userinfo, path, query or fragment. Anything laxer here
 * would be a weaker control wearing the same name — and the value flows into a
 * URL that carries CHECKOUT_SESSION_ID, or is sent to the OAuth server as the
 * redirect URI.
 *
 * `http://localhost` is exempt from the https requirement, and only outside
 * production.
 */
export function normaliseConfiguredOrigin(
  value: string,
  allowHttpLocalhost = false,
): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const schemeOk =
    url.protocol === "https:" || (allowHttpLocalhost && url.protocol === "http:" && isLocalhost);

  if (!schemeOk) return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;

  return url.origin;
}

export function allowedPublicOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const allowHttpLocalhost = env.NODE_ENV !== "production";
  const configured = [env.PUBLIC_BASE_URL, env.PROMOTION_PUBLIC_ORIGIN]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map(value => normaliseConfiguredOrigin(value, allowHttpLocalhost))
    .filter((value): value is string => value !== null);

  // Same shape and the same hostname guard as api/promotion-fix.js.
  if (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_URL === "string" &&
    /^[a-zA-Z0-9.-]+$/.test(env.VERCEL_URL)
  ) {
    configured.push(`https://${env.VERCEL_URL}`);
  }

  if (allowHttpLocalhost) configured.push("http://localhost:3000");

  // Array.from rather than [...set]: this tsconfig targets below es2015, where
  // spreading a Set needs --downlevelIteration. Loosening the project's compiler
  // settings to dedupe a three-element list would be the wrong trade.
  return Array.from(new Set(configured));
}

/**
 * Pick the origin to use. The request's `Origin` can only SELECT among origins
 * already trusted — it can never introduce one. With nothing configured this
 * throws rather than guessing: a checkout that silently returns customers to the
 * wrong host, or a sign-in that redirects to one, is worse than one that refuses
 * to start.
 */
export function resolvePublicOrigin(
  requestOrigin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const allowed = allowedPublicOrigins(env);
  if (allowed.length === 0) {
    throw new Error(
      "No checkout return origin is configured. Set PUBLIC_BASE_URL (or PROMOTION_PUBLIC_ORIGIN) " +
        "to this deployment's public origin.",
    );
  }
  const normalised = requestOrigin?.replace(/\/+$/, "");
  return normalised && allowed.includes(normalised) ? normalised : allowed[0];
}
