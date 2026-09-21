# Package pin status — Stripe webhook adapter (PR #4)

**scope:** documentation only. No private `jarus/` in git. No host mutate from Forge.

## Blade prepared pin (NOT host-qualified)

| Field | Value |
|-------|-------|
| SHA-256 | `3d32f1514bb089f4f93bd46745b30af8080cbafa54fa71e23572a02f203d3802` |
| Where prepared | Blade `stripe-webhook-host-20260921` → `.vercel/qualification/output` |
| Meaning | Local package proof that the reviewed engine bytes hash to this digest |
| Host status | **NOT qualified** — Vercel runtime path/readback still outstanding |

## Explicit non-claims

- This digest is **not** the Forge-box pin `eb95f633…`. Do not substitute.
- Presence of the Blade output directory is **not** Stage 4 GREEN / host proof.
- Do **not** vendor private `jarus/` into `sovereign-public-face`.

## What Codex must inject after real deploy

| Env | Role |
|-----|------|
| `JARUS_RECEIPT_ENGINE_PATH` | Absolute path to engine entry on the **runtime host** (candidate packaging path `/var/task/.private/jarus/index.js` — confirm on host) |
| `JARUS_RECEIPT_ENGINE_SHA256` | SHA-256 of the **mounted** bytes (re-hash on host; may match `3d32f151…` if packaging is byte-identical) |

## Related production note (t736u)

`STRIPE_SECRET_KEY` is **CONFIGURED** on Production for bound project `prj_0F4lm0ET6Xo3uB09JYXsS6x1obWg`. Do not report all seven inputs as SOURCE ABSENT.
