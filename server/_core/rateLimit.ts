import type { NextFunction, Request, RequestHandler, Response } from "express";
import { clientKey, consume } from "../rateLimit.mjs";

/**
 * Express middleware over the shared limiter in `server/rateLimit.mjs`.
 *
 * All the policy — the store, the window, the budgets, the fail-open choice and
 * the reason the Stripe webhook is excluded — lives in that module, because
 * `api/promotion-fix.js` has to share it. This file only turns the result into
 * an HTTP answer.
 */
export { API_LIMIT, OAUTH_LIMIT, PROMOTION_LIMIT } from "../rateLimit.mjs";

/**
 * `prefix` keeps each surface's budget separate, so a burst of ordinary page
 * loads cannot consume the sign-in allowance.
 */
export function rateLimit(prefix: string, requests: number): RequestHandler {
  return function applyRateLimit(req: Request, res: Response, next: NextFunction) {
    void consume(prefix, requests, clientKey(req)).then(
      ({ allowed, retryAfterSeconds }) => {
        if (allowed) return next();
        res.setHeader("Retry-After", String(retryAfterSeconds));
        // A shared cache or CDN that stored this 429 would serve it to callers
        // who are well within budget — the mitigation causing the outage it is
        // meant to prevent.
        res.setHeader("Cache-Control", "no-store");
        // No budget, no window, no remaining count in the body: those would tell
        // an attacker exactly how to pace a slower attempt.
        res.status(429).json({ error: "Too many requests. Please try again shortly." });
      },
      // `consume` already fails open on a store error, so reaching here means
      // the limiter itself is broken. Still allow the request — a bug in a
      // mitigation must not take the site down — but say so loudly.
      error => {
        console.error("[rate-limit] middleware failed, allowing the request:", error);
        next();
      },
    );
  };
}
