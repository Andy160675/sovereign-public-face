# Vercel Stripe webhook adapter (Stage 4 PREPARE)

**scope:** source adapter only. Codex owns Vercel project create/link/settings/deploy.  
**surface:** `POST /api/stripe/webhook` — **RECORDED_ONLY**. Check 3 business effect **HELD**.

## What this adapter does

1. `server/createStripeWebhookApp.ts` — Express factory that registers
   `registerStripeWebhook(app)` with **raw body** and does **not** call `listen()`.
2. `api/stripe/webhook.ts` — Vercel Node function exporting that app; platform
   `bodyParser` disabled so signed bytes reach `express.raw()`.
3. `vercel.json` — SPA fallback excludes `/api/*` so `dist/public` rewrites cannot
   swallow the webhook route.

tRPC, OAuth, and checkout are **not** mounted on the serverless surface.

## Pin contract (no private JARUS vendoring)

Do **not** copy private `jarus/` into this public repo. Load ReceiptEngine only via:

| Env name | Role |
|----------|------|
| `JARUS_RECEIPT_ENGINE_PATH` | Absolute path to reviewed engine entry on the **runtime host** (or function layer Codex mounts) |
| `JARUS_RECEIPT_ENGINE_SHA256` | SHA-256 of those exact bytes |
| `STRIPE_RECEIPT_DATABASE_URL` | Prod MySQL journal URI |
| `STRIPE_WEBHOOK_SECRET` | Stripe signing secret |
| `STRIPE_SECRET_KEY` | Stripe SDK init |
| `STRIPE_RECEIPT_MODE` | `live` or omit/`test` |
| `STRIPE_RECEIPT_CONNECTOR_ID` | Connector PK |

Resolution order (see `server/stripe-receipt-store.ts` + `docs/CI-JARUS-RECEIPT-ENGINE.md`):

1. `JARUS_RECEIPT_ENGINE_PATH` (+ matching `JARUS_RECEIPT_ENGINE_SHA256`)
2. else `require.resolve("@codex-sovereign/jarus")` when a private registry/workspace link exists

Box/CI pin is **evidence only**, not production proof. Production must re-hash the
bytes actually mounted on the Vercel function and set `JARUS_RECEIPT_ENGINE_SHA256`
to that digest.

## Ownership

| Surface | Owner |
|---------|--------|
| This adapter branch / draft PR / tests | Forge |
| Vercel project create/link/env/deploy | **Codex alone** |
| Merge to main / Stage 5 | HELD until Stage 4 QUALIFY GREEN |

## Local acceptance (no live Stripe)

```bash
export JARUS_RECEIPT_ENGINE_PATH="/absolute/path/to/jarus/dist/index.js"
export JARUS_RECEIPT_ENGINE_SHA256="<sha256 of that file>"
export STRIPE_SECRET_KEY="sk_test_ci_dummy_not_live"
pnpm test   # or: node scripts/ci-with-jarus-pin.mjs
```

Adapter suite: `server/stripe-webhook-vercel-adapter.test.ts` — raw-body
preservation, invalid signature fail-closed (400), valid fixture → RECORDED_ONLY.
