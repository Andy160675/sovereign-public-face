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
   * When true (default for Vercel entry), only the webhook route is registered.
   * Full long-running servers attach JSON/OAuth/tRPC themselves after this factory
   * or use createFullHttpApp in _core/index.
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
  return app;
}

export default createStripeWebhookApp;
