/**
 * Stripe Webhook Handler
 * Registered BEFORE express.json() to receive raw body for signature verification.
 */
import type { Express } from "express";
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        console.warn("[Stripe Webhook] Missing signature or webhook secret");
        return res.status(400).json({ error: "Missing signature or secret" });
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook signature verification failed` });
      }

      // Handle test events for webhook verification
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`[Stripe Webhook] Checkout completed: ${session.id}`);
            console.log(`[Stripe Webhook] Customer: ${session.customer_email}`);
            console.log(`[Stripe Webhook] Amount: ${session.amount_total} ${session.currency}`);
            console.log(`[Stripe Webhook] Metadata:`, session.metadata);
            // Future: update order status in database
            break;
          }

          case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            console.log(`[Stripe Webhook] Subscription ${event.type}: ${subscription.id}`);
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        return res.json({ received: true });
      } catch (err: any) {
        console.error(`[Stripe Webhook] Error processing event: ${err.message}`);
        return res.status(500).json({ error: "Internal processing error" });
      }
    }
  );
}
