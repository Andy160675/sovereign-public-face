/**
 * Express app factory for the Stripe webhook surface (no listen()).
 *
 * Used by:
 * - Long-running Node host via server/_core/index.ts (full app still owns listen)
 * - Vercel Node function at api/stripe/webhook.ts (webhook-only surface)
 *
 * Contract:
 * - registerStripeWebhook BEFORE any express.json()
 * - never call listen()
 * - RECORDED_ONLY — no fulfilment / Check-3 business effect
 * - serverless export intentionally omits tRPC / OAuth / checkout
 */
import express, { type Express } from "express";
import {
  registerStripeWebhook,
  type StripeWebhookOptions,
} from "./stripe-webhook";

export type CreateStripeWebhookAppOptions = {
  /** Injectable Stripe webhook options (tests / journal injection). */
  stripe?: StripeWebhookOptions;
  /**
   * When true (Vercel / adapter tests), only the webhook route is registered and
   * this factory must not mount express.json, tRPC, OAuth, or checkout.
   * When false/omitted (long-running _core), callers attach those after return.
   */
  webhookOnly?: boolean;
};

/**
 * Build an Express app with the Stripe webhook registered on raw body.
 * Does not call listen(). Does not mount express.json() before the webhook.
 */
export function createStripeWebhookApp(
  options: CreateStripeWebhookAppOptions = {},
): Express {
  const app = express();
  // Raw-body route MUST be registered before any global JSON parser.
  registerStripeWebhook(app, options.stripe);

  if (options.webhookOnly === true) {
    // Serverless / adapter surface: never mount extras on this app.
    // Vercel entry (api/stripe/webhook.ts) passes webhookOnly: true explicitly.
    return app;
  }

  // Long-running hosts (_core/index.ts) attach JSON/OAuth/tRPC after return.
  // This factory still never mounts those itself — webhook-first only.
  return app;
}

export default createStripeWebhookApp;
