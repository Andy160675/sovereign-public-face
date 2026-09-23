# Promotion Fix payment callback

The Promotion Fix order remains private behind the customer's recovery token. The callback records a paid Stripe Checkout session against that order without requiring the customer to return from Stripe. It does not email or expose the result, and it does not establish bank settlement.

Set `PROMOTION_WEBHOOK_SECRET` in the Vercel environment for this deployment. Register a separate Stripe event destination at `https://sovereign-public-face.vercel.app/api/promotion-fix-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded` in the matching test or live Stripe mode. Use that destination's signing secret; the existing receipt-journal webhook remains separate.

The endpoint checks the raw-body Stripe signature and timestamp. For the Promotion Fix product it retrieves the Checkout session from Stripe, compares the saved order, product, amount, currency and mode, then stores one durable payment receipt. It returns a retryable failure if Stripe or storage is unavailable. Duplicate callbacks and a later customer return preserve the first receipt.

Before enabling the live event destination, send a genuine Stripe test-mode checkout through the complete path, leave Checkout without returning, confirm the stored order becomes `PAID`, then use its private recovery link to retrieve the same result and receipt. Check duplicate delivery and an upstream outage. A test-mode receipt is not revenue; inspect a separate live transaction and payout before claiming cash.

The callback does not replace Josh's full promotion pack with the 150-word Promotion Fix. Josh's £15 full-pack arrangement and any general offer/pricing decision remain separate.
