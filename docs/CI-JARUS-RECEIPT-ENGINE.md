# CI — ReceiptEngine pin (no private jarus vendored)

`@codex-sovereign/jarus` is **not** published on the public npm registry for this repo.
Clean CI / clean install of `sovereign-public-face` must **not** vendor private `jarus/` source.

## Required env (tests that load ReceiptEngine)

| Variable | Meaning |
|----------|---------|
| `JARUS_RECEIPT_ENGINE_PATH` | **Absolute** path to the reviewed jarus entry (`…/dist/index.js`) |
| `JARUS_RECEIPT_ENGINE_SHA256` | SHA-256 of that file’s bytes (must match) |

### Pin digest (this Stage-3 seal)

Verified on the forge seat by hashing the CI entry file:

```
eb95f6331f3396703c4dee49158849194126bb8ff092100cf3a9a7c2d6dafa48
```

Prior Blade Stage-1 attestation cited
`3d32f1514bb089f4f93bd46745b30af8080cbafa54fa71e23572a02f203d3802`
(internal-closeout worktree dist). That exact file was **not** present on this
seat; CI must pin whatever entry the runner mounts and record its SHA-256 here
when it changes. Do not claim the old digest without re-hashing.

## Local / CI run

```bash
export JARUS_RECEIPT_ENGINE_PATH="/absolute/path/to/jarus/dist/index.js"
export JARUS_RECEIPT_ENGINE_SHA256="eb95f6331f3396703c4dee49158849194126bb8ff092100cf3a9a7c2d6dafa48"
export STRIPE_RECEIPT_SECRET_KEY="sk_test_ci_dummy_not_live"   # receipt signature fixture only; no live Stripe
node scripts/ci-with-jarus-pin.mjs   # fails closed on missing/wrong pin, then npm test
```

### Unit subset vs MySQL durability

- Default `npm test` / `ci-with-jarus-pin.mjs`: unit + webhook suite. The MySQL
  durability file is **in tree** but **skips** unless `STRIPE_RECEIPT_MYSQL_URI`
  is set (along with the jarus pin env).
- Durability CI job: set pin env **and** `STRIPE_RECEIPT_MYSQL_URI` to a non-prod
  MySQL (e.g. Docker `127.0.0.1:3307`), apply `server/migrations/001_stripe_receipts.sql`,
  then re-run `node scripts/ci-with-jarus-pin.mjs` (expect durability 3/3).

## package.json

Do **not** add a fake public `@codex-sovereign/jarus` version. Resolution order in
`server/stripe-receipt-store.ts`:

1. `JARUS_RECEIPT_ENGINE_PATH` (+ SHA256 when provided / required)
2. else `require.resolve("@codex-sovereign/jarus")` when a private registry/workspace link exists

## RECORDED_ONLY / Check 3

This pin proves receipt-chain hashing only. It does **not** prove business effect,
entitlement, payment success, or customer outcome. Stages 4–5 remain HELD until
Master seals Stage 1–3 GREEN **and** Check 3 stays HELD for record-only deploy.
