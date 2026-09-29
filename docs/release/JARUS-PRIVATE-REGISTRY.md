# Supplying the receipt engine from a private registry

## Why this exists

`server/stripe-receipt-store.ts` resolves the canonical receipt engine with
`require.resolve("@codex-sovereign/jarus")`. That package is not installed
here, is in neither `package.json` nor `pnpm-lock.yaml`, and is not published
anywhere. So the first `journal.transact` in the Stripe webhook throws
`MODULE_NOT_FOUND`, every delivery answers HTTP 500, and no receipt is ever
admitted.

Measured, one variable changed:

| Condition | Result |
|---|---|
| No engine (current state) | 31 failed / 3 passed |
| Engine built, supplied and correctly pinned | 34 / 34 passed |
| Engine supplied, deliberately wrong pin | 31 failed — pin enforced |

This is the cause of the webhook's failure to admit, of `verify` never having
passed on `main`, and of Point Break VF-2026-001 being fulfilled by hand.

## Why not the path variable on Vercel

`receiptRuntime()` calls `readFileSync(entry)` and `require(entry)`, so
`JARUS_RECEIPT_ENGINE_PATH` must name a file present on the serverless
filesystem at runtime. `vercel.json` runs only `pnpm install` and
`pnpm run build`, and the engine is not a dependency, so nothing places one
there. Setting that variable on Vercel converts `MODULE_NOT_FOUND` into an
`ENOENT` on a path that does not exist. It does not fix delivery.

Publishing to a private registry is the route that works on serverless: the
package installs normally, `require.resolve` succeeds unchanged, and only the
SHA pin needs to be configured.

`scripts/ci-with-jarus-pin.mjs` keeps its purpose — it is for environments
where an operator has placed the engine on disk. Nothing here vendors engine
source into this repository, and nothing should.

## Steps

### 1. Publish the package — human act, not automatable

In the `codex-sovereign` repository, `jarus/package.json` carries
`"private": true` and `"license": "UNLICENSED"`. Publication requires a person
to change both. The sibling package `packaging/jarus-core` states the reason
that field exists: removing it is the act that makes `npm publish` possible,
and publishing is an externally-visible, non-delegable class of action.
**No automated process should remove it.**

Set a licence appropriate to a private package (e.g. `"SEE LICENSE IN
LICENSE"` with a proprietary licence file), build, and publish:

```
cd jarus
pnpm exec tsc -b            # produces dist/index.js
npm publish                 # to the private registry, not the public one
```

Confirm before publishing that `files` is `["dist", "README.md"]` so only the
built engine ships.

### 2. Package name

GitHub Packages scopes a package to the owning account and requires lowercase
names. The repository owner is `Blade2AI`, so `@codex-sovereign/jarus` may be
rejected there.

- Preferred: keep `@codex-sovereign/jarus` — no code change anywhere.
- If GitHub rejects the scope: either publish to a registry that permits the
  `@codex-sovereign` scope, or rename to `@blade2ai/jarus` and update the one
  import in `server/stripe-receipt-store.ts` (the `require.resolve` call).

`.npmrc` maps both scopes, so no change is needed here either way.

### 3. Add the dependency and regenerate the lockfile — one command

CI installs with `--frozen-lockfile`, so `package.json` and `pnpm-lock.yaml`
must change together. After publication:

```
JARUS_REGISTRY_TOKEN=<read:packages token> pnpm add @codex-sovereign/jarus@0.1.0
```

Commit both files. Pin the exact version: a version bump changes the engine
bytes and must break the SHA pin deliberately, not silently.

### 4. Compute the SHA pin

From the *installed* artifact, never from a local build tree:

```
node -e "const{createHash}=require('crypto'),{readFileSync}=require('fs');\
console.log(createHash('sha256').update(readFileSync(require.resolve('@codex-sovereign/jarus'))).digest('hex'))"
```

For reference, a `tsc -b` build of `jarus/` at current HEAD produced
`bdd7a5e159737a6d9827df757347ffb4727303fdba1249bede4a9eef4f6915cf`. Do not
pin that value on trust — recompute from what actually installs.

### 5. Vercel variables

On project `sovereign-public-face`, production:

| Variable | Value |
|---|---|
| `JARUS_REGISTRY_TOKEN` | read-only `read:packages` token, so `pnpm install` can fetch the engine at build time |
| `JARUS_RECEIPT_ENGINE_SHA256` | the hex digest from step 4 |

Do **not** set `JARUS_RECEIPT_ENGINE_PATH`. With the package installed,
`require.resolve` finds the engine; an absolute path would only override that
with a location which does not exist in the serverless filesystem.

### 6. Still outstanding after this

Resolving the engine is necessary but not sufficient. These remain absent from
production and the webhook cannot complete a delivery without them:

- `STRIPE_WEBHOOK_SECRET` — without it, signature verification answers 503
- `STRIPE_RECEIPT_CONNECTOR_ID`
- `STRIPE_RECEIPT_DATABASE_URL`
- `STRIPE_RECEIPT_MODE`

## Verifying it worked

```
pnpm test                                    # expect the 31 failures to clear
```

In production, the first webhook delivery should log
`disposition=recorded`. A failure now names itself, e.g.
`[Stripe Webhook] receipt fault stage=delivery cause=JARUS_RUNTIME_PIN_MISMATCH`.
