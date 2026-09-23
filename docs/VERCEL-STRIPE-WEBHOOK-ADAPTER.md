# Vercel Stripe webhook adapter (Stage 4 PREPARE)

**scope:** source adapter only. Codex owns Vercel project create/link/settings/env/deploy.
**surface:** `POST /api/stripe/webhook` — **RECORDED_ONLY**. Check 3 business effect **HELD**.

## Bound host TARGET (t727u — G1 CLOSED; docs only — no Vercel mutate here)

| Item | Value |
|------|-------|
| Vercel project name | `sovereign-public-face` |
| Project id | `prj_0F4lm0ET6Xo3uB09JYXsS6x1obWg` |
| Team id | `team_r5WswUIfukbM16eQNWHGXT1S` |
| Intended webhook URL | `https://sovereign-public-face.vercel.app/api/stripe/webhook` |
| Prod env vars today | **`STRIPE_SECRET_KEY` CONFIGURED** (Production, sensitive). Remaining six still need Codex provision / host pin inject — do **not** claim all-seven SOURCE ABSENT |
| Attach to `codex-sovereign` | **FORBIDDEN** |

This document **names** the host. Forge does **not** create/link/delete the project, set env, or deploy.

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


## Blade qualification pin (local package proof ONLY)

| Item | Value |
|------|-------|
| Engine SHA-256 | `3d32f1514bb089f4f93bd46745b30af8080cbafa54fa71e23572a02f203d3802` |
| Prepared path (Blade) | `stripe-webhook-host-20260921/.vercel/qualification/output` (under `C:/Users/andyj/Workspace/`) |
| Status | **NOT host-qualified** — Linux-local / Blade prepared output only |
| Do **not** claim | Forge-box pin `eb95f633…` is this pin |
| Do **not** vendor | Private `jarus/` into this public git repo |

After a real deploy, Codex must inject `JARUS_RECEIPT_ENGINE_PATH` + `JARUS_RECEIPT_ENGINE_SHA256` from the **bytes actually mounted** on the Vercel function (re-hash on host; do not copy the Blade digest blindly if packaging changes).

## Ownership

| Surface | Owner |
|---------|--------|
| This adapter branch / draft PR / tests | Forge |
| Vercel project create/link/env/deploy | **Codex alone** |
| Merge to main / Stage 5 | HELD until Stage 4 QUALIFY GREEN |

## Live raw-body / bodyParser proof (H2 — QUALIFY / Codex)

Source sets `config.api.bodyParser = false` and registers raw body before JSON.
**Forge did not hit the bound host.** Live proof that the Vercel platform honours
signed bytes on `https://sovereign-public-face.vercel.app/api/stripe/webhook`
remains **Codex / QUALIFY after Stage4 env inject** — not closed by this draft seat.

## Local acceptance (no live Stripe)

```bash
export JARUS_RECEIPT_ENGINE_PATH="/absolute/path/to/jarus/dist/index.js"
export JARUS_RECEIPT_ENGINE_SHA256="<sha256 of that file>"
export STRIPE_SECRET_KEY="sk_test_ci_dummy_not_live"
pnpm test   # or: node scripts/ci-with-jarus-pin.mjs
```

Adapter suite: `server/stripe-webhook-vercel-adapter.test.ts` — raw-body
preservation, invalid signature fail-closed (400), valid fixture → RECORDED_ONLY.

## TypeScript / Vercel builder (TS2339)

Root `tsconfig.json` previously omitted `api/**` from `include`, and `"types": ["node","vite/client"]` does not auto-pull Express ambients. When the Vercel Node builder typechecks the function with degraded Express typings, `Request`/`Response` collapse and **TS2339** appears on `req.body` / `res.status` even if the overall build exits 0.

Mitigations on this branch:
- `api/` added to root `include`
- `api/tsconfig.json` with explicit `typeRoots` → `../node_modules/@types` (Vercel finds this before root when compiling `api/stripe/*`)
- Vercel entry exports `RequestHandler` (Express app)
- Handler uses `ExpressRequest` / `ExpressResponse` aliases (avoid Node 24 Fetch globals)
- `@types/express` moved to **dependencies** so qualify/prod installs still resolve Express members

Do **not** treat `skipLibCheck` alone as the fix.
