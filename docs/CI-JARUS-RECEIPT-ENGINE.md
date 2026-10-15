# CI — ReceiptEngine pin (no private jarus vendored)

`@codex-sovereign/jarus` is **not** published on the public npm registry for this repo.
Clean CI / clean install of `sovereign-public-face` must **not** vendor private `jarus/` source.

## Required env (tests that load ReceiptEngine)

| Variable | Meaning |
|----------|---------|
| `JARUS_RECEIPT_ENGINE_PATH` | **Absolute** path to the reviewed canonical entry (`receipt-engine.cjs` in the current CI route) |
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
export JARUS_CI_SOURCE_PATH="/private/source/receipt-engine.ts"
export JARUS_CI_OUTPUT_DIR="/private/temporary/receipt-runtime"
node scripts/prepare-jarus-ci.mjs
export JARUS_RECEIPT_ENGINE_PATH="$JARUS_CI_OUTPUT_DIR/receipt-engine.cjs"
export JARUS_RECEIPT_ENGINE_SHA256="775d572ad04b2d17aead2567a98a730d971d14eb74b3da8cc5fa9ddd62249adb"
node scripts/ci-with-jarus-pin.mjs   # fails closed on missing/wrong pin, then npm test
```

The current canonical-source provisioning route is documented in
[`scripts/JARUS-CI.md`](../scripts/JARUS-CI.md) and pinned in
[`scripts/jarus-ci-pin.json`](../scripts/jarus-ci-pin.json). The Stage-3 digests
above are historical observations. The current preparer requires the exact
private source, TypeScript 5.9.3 and matching emitted bytes; its output
must be outside the public checkout and must not already contain the entry.
No global `STRIPE_SECRET_KEY` is needed to import public authentication and
product routes. Checkout tests supply synthetic fixture keys and replace only
the network boundary while retaining the real SDK constructor. An authenticated
checkout request without a key fails closed with `PRECONDITION_FAILED`
(`Checkout is not configured`). This does not enable production checkout.

Public CI still requires fresh authenticated private-integration proof for each
exact public commit. This source change does not supply that proof, alter the
canonical engine or webhook design, or replace the MySQL durability checks.

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
