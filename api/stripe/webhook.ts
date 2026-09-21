/**
 * Vercel Node function — POST /api/stripe/webhook (RECORDED_ONLY).
 *
 * Platform body parser is disabled so express.raw() inside registerStripeWebhook
 * receives the exact signed bytes Stripe sent. Do not add fulfilment here.
 *
 * Codex owns Vercel project create/link/settings. This file is source adapter only.
 */
import { createStripeWebhookApp } from "../../server/createStripeWebhookApp";

// Disable Vercel/Node platform JSON parsing — Stripe signature needs raw bytes.
export const config = {
  api: {
    bodyParser: false,
  },
};

const app = createStripeWebhookApp({ webhookOnly: true });

export default app;
