/**
 * Vercel Node function — POST /api/stripe/webhook (RECORDED_ONLY).
 *
 * Platform body parser is disabled so express.raw() inside registerStripeWebhook
 * receives the exact signed bytes Stripe sent. Do not add fulfilment here.
 *
 * Codex owns Vercel project create/link/settings. This file is source adapter only.
 *
 * Export is an Express RequestHandler (the app itself) so the Vercel Node builder
 * typechecks against @types/express Request/Response members rather than the
 * global Fetch Request/Response from @types/node, which caused TS2339 on
 * req.body / res.status when Express typings failed to resolve.
 */
import type { RequestHandler } from "express";
import { createStripeWebhookApp } from "../../server/createStripeWebhookApp";

// Disable Vercel/Node platform JSON parsing — Stripe signature needs raw bytes.
export const config = {
  api: {
    bodyParser: false,
  },
};

const app = createStripeWebhookApp({ webhookOnly: true });

// Application is a RequestHandler; assert the Express contract explicitly.
const handler: RequestHandler = app;

export default handler;
