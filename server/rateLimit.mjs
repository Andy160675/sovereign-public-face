/**
 * Rate limiting — the one place that knows how this app counts requests.
 *
 * Nothing rate-limited the authenticated surface before this. An in-memory
 * counter was not worth shipping: `/api/trpc` and `/api/oauth` are served by
 * the long-running Express host, but `api/*` are Vercel functions, and a
 * per-instance counter spread across serverless invocations does not limit
 * anything — it reports a number nobody can rely on. Upstash is reachable over
 * HTTP from both, so one shared store actually counts.
 *
 * This module is plain ESM rather than TypeScript because both callers have to
 * import it: the TS Express host (via `server/_core/rateLimit.ts`, typed by
 * `rateLimit.d.mts`) and `api/promotion-fix.js`, which is JavaScript. Two code
 * paths with their own notion of the same env var is how one of them ends up
 * weaker — which is exactly what happened between the old checkout code and
 * `api/promotion-fix.js` over the public origin.
 *
 * ## Fail OPEN, deliberately
 *
 * If Upstash is unreachable, the request is allowed and the error is logged.
 *
 * This is the opposite choice from `/api/oauth/start`, which fails closed when
 * it is unconfigured, and the difference is not inconsistency. There, failing
 * open would mean sending a customer to an unverified host — a security event.
 * Here, failing closed would mean refusing every customer because Redis
 * hiccuped — an availability event, while the thing being prevented is abuse.
 * A rate limiter is a mitigation, not an authentication control, so it must not
 * become a single point of failure for the whole site.
 *
 * ## Unconfigured is a loud no-op, not a crash
 *
 * With no Upstash credentials the limiter is disabled and says so in
 * production. It is deliberately NOT hard-required: making the checkout return
 * origin hard-required without documenting it would have taken checkout down
 * for anyone provisioning from `.env.example`, and that lesson applies here
 * too. Rate limiting is worth having; it is not worth risking the site to
 * enforce its presence. Both variables are documented in `.env.example`.
 *
 * ## What is NOT rate-limited, and why
 *
 * The Stripe webhooks. Their control is signature verification over raw bytes,
 * and they are idempotent. Throttling them would discard legitimate Stripe
 * retries — real damage, in exchange for no benefit against an attacker who
 * cannot forge a signature anyway.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** The window every budget below is measured over. */
export const WINDOW = "1 m";

/** Sign-in and the OAuth callback. Tight: these are credential-adjacent. */
export const OAUTH_LIMIT = 10;

/**
 * The tRPC surface. Generous on purpose — `auth.me` runs on every page load, so
 * a tight budget here would throttle ordinary browsing rather than abuse.
 */
export const API_LIMIT = 120;

/**
 * The promotion-fix envelope. Its `prepare` action already has its own hourly
 * per-IP limit in `promotion-fix-service.mjs`, enforced against Neon; this is
 * the envelope budget that also covers `checkout`, `result` and `simulate`,
 * which had none. It does not replace the inner limit — the inner one guards
 * two paid model calls, this one guards the function itself.
 */
export const PROMOTION_LIMIT = 30;

let redis;

function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[rate-limit] DISABLED: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN " +
          "are not set. Requests are NOT being rate limited.",
      );
    }
    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map();

function getLimiter(prefix, requests) {
  const cached = limiters.get(prefix);
  if (cached !== undefined) return cached;

  const client = getRedis();
  if (!client) {
    limiters.set(prefix, null);
    return null;
  }

  const limiter = new Ratelimit({
    redis: client,
    // Sliding rather than fixed window: a fixed window lets twice the budget
    // through either side of a boundary, which is exactly when a burst lands.
    limiter: Ratelimit.slidingWindow(requests, WINDOW),
    prefix: `ratelimit:${prefix}`,
    analytics: false,
  });

  limiters.set(prefix, limiter);
  return limiter;
}

/**
 * Addresses that identify a hop rather than a client: loopback, the RFC1918
 * ranges, link-local, and IPv6 unique-local. A request arriving from one of
 * these came through something in front of the app, so the socket address is
 * that something's address — not an identity to meter on.
 */
function isInfrastructureAddress(address) {
  if (typeof address !== "string" || address === "") return true;
  // Express reports IPv4-mapped IPv6 as ::ffff:a.b.c.d.
  const plain = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (plain === "::1" || plain === "127.0.0.1" || plain === "0.0.0.0") return true;
  if (/^127\./.test(plain)) return true;
  if (/^10\./.test(plain)) return true;
  if (/^192\.168\./.test(plain)) return true;
  if (/^169\.254\./.test(plain)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(plain)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(plain)) return true;
  if (/^fe80:/i.test(plain)) return true;
  return false;
}

let warnedUnidentifiable = false;

/**
 * The caller's address, used as the bucket key — or `null` when this request
 * cannot be attributed to a caller.
 *
 * Getting this wrong is costly in BOTH directions, which is why it is explicit
 * rather than clever:
 *
 *  - Trust a spoofable header and an attacker evades their own budget AND can
 *    exhaust a victim's by forging the victim's address. That is worse than no
 *    limiter.
 *  - Key on the socket address while sitting behind a reverse proxy and every
 *    client shares one bucket, so the whole site is throttled to one client's
 *    budget. That is an outage caused by the mitigation.
 *
 * The Express host is the case that matters: the Vercel deployment routes only
 * the static bundle and the three `api/*` functions, so `/api/trpc` and
 * `/api/oauth` are served by the long-running host elsewhere, which is behind an
 * edge. So:
 *
 *  1. On Vercel, use `x-vercel-forwarded-for`. The platform overwrites it, so it
 *     is not client-settable — the same reasoning `api/promotion-fix.js` already
 *     applies when keying its inner limit.
 *  2. Otherwise, if RATE_LIMIT_TRUSTED_PROXIES names how many hops sit in front
 *     of this app, take the entry that many places from the END of
 *     `x-forwarded-for`. Each trusted hop APPENDS the address it saw, so
 *     counting from the right skips exactly the trusted portion and lands on the
 *     address the outermost trusted proxy observed. Anything the client prepends
 *     sits to the left of that and is ignored.
 *  3. Otherwise use the socket address — correct for a directly exposed host.
 *     But if that address is itself infrastructure, the client is unidentifiable
 *     and this returns `null` rather than lumping everyone together.
 *
 * Returning `null` means "do not limit this request". An unmetered window is a
 * smaller harm than metering the entire site through one bucket, and it is
 * honest: the log line names the variable that fixes it.
 */
export function clientKey(req) {
  const headers = req?.headers ?? {};

  if (process.env.VERCEL) {
    const platform = headers["x-vercel-forwarded-for"];
    if (typeof platform === "string" && platform.length > 0) {
      return platform.split(",")[0].trim();
    }
  }

  const hops = Number.parseInt(process.env.RATE_LIMIT_TRUSTED_PROXIES ?? "", 10);
  if (Number.isInteger(hops) && hops >= 1) {
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const chain = forwarded.split(",").map(part => part.trim()).filter(Boolean);
      // chain[length - hops] is what the outermost trusted proxy saw. Fewer
      // entries than configured hops means the chain is not the expected one,
      // so fall through rather than trusting a short header.
      const candidate = chain[chain.length - hops];
      if (candidate) return candidate;
    }
  }

  const socketAddress = req?.socket?.remoteAddress;
  if (isInfrastructureAddress(socketAddress)) {
    if (!warnedUnidentifiable) {
      warnedUnidentifiable = true;
      console.error(
        "[rate-limit] NOT limiting: requests arrive from " +
          `${socketAddress || "an unknown address"}, which is a proxy or ` +
          "loopback address, so callers cannot be told apart. Keying on it " +
          "would meter the whole site through one bucket. Set " +
          "RATE_LIMIT_TRUSTED_PROXIES to the number of proxies in front of " +
          "this app to enable per-caller limits.",
      );
    }
    return null;
  }
  return socketAddress;
}

/**
 * Consume one unit from `prefix`'s budget for `key`.
 *
 * Returns `{ allowed, retryAfterSeconds }`. `allowed` is true when the limiter
 * is disabled or unreachable — see the fail-open note above. The raw address is
 * never logged or returned.
 */
export async function consume(prefix, requests, key) {
  // A null key is clientKey() reporting that this request cannot be attributed
  // to a caller — see the note there. Metering it would share one bucket.
  if (key === null || key === undefined || key === "") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const limiter = getLimiter(prefix, requests);
  if (!limiter) return { allowed: true, retryAfterSeconds: 0 };

  try {
    const { success, reset } = await limiter.limit(key);
    if (success) return { allowed: true, retryAfterSeconds: 0 };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    // Fail OPEN — see the note at the top of this file.
    console.error(
      "[rate-limit] store unreachable, allowing the request:",
      error instanceof Error ? error.message : error,
    );
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** True when credentials are present, i.e. requests are actually being counted. */
export function isRateLimitConfigured() {
  return getRedis() !== null;
}

/** Tests only: forget the cached client and limiters so env changes take effect. */
export function resetRateLimitStateForTests() {
  redis = undefined;
  limiters.clear();
  warnedUnidentifiable = false;
}
