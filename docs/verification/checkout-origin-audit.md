# Checkout return-origin audit — 11 November 2026

PR #19: return URLs previously trusted caller-controlled Origin/Referer.
The route now selects only a configured public origin and refuses production
checkout when none is valid. The shared resolver is copied unchanged from
composition PR #22 at d1881c43cbacb13752bbb4b80f9cfb9c1c2253cb.
Stripe key handling, prices, metadata, recurrence and success/cancel paths are preserved.

## Reproduction and verification

Run from repository root with Node 24 or newer:

```sh
node --test docs/verification/checkout-origin-audit.mjs
```

Linux Node 24.22.1: **30 passed, 0 failed, 0 skipped** on this candidate.
The same probes against the original router produced **27 passed, 3 failed**:
hostile Origin, hostile Referer, and missing configured production origin.
There are 23 resolver cases and 7 checkout-handler cases. The harness executes
actual TypeScript source after Node type stripping; tRPC builders and the Stripe
constructor/network are fixtures. No network request or payment is performed.
This does not verify framework authentication, Stripe SDK integration or a full
TypeScript typecheck. Payment/subscription request fields, missing keys and
unknown products have passing direct-handler countercases.

The normal Vitest suite gains 23 resolver cases and 3 actual-router cases; its
existing key-configuration fixture now supplies PUBLIC_BASE_URL explicitly.
Those Vitest tests and tsc were **not run in this Linux snapshot** because the
repository dependency graph is unavailable. Prior remote post-fix logs remain
unread and are not claimed as passing. No dependencies were installed.

No private ReceiptEngine was copied or mocked to claim integration success.
Canonical engine provisioning, MySQL durability, real OAuth/payment/delivery and
production release remain unqualified. Draft branch update only; no merge.
