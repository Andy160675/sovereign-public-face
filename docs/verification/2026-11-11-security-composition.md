# Public face composition audit - 11 November 2026

Candidate combines PR #22 `e164ee5a874d942c49d1cd94c953b37bb9a8ba4e` with PR #15 security and audited OAuth correction `d58a56bb9abd238eb3b9bdbb39ce061788093707`. The subsequent PR #15 CSP checkout fix is also incorporated. No release, deployment, customer operation, paid service or real provider call was performed.

## Corrections and retained scope

- PR #22 still derived Checkout return URLs from untrusted Origin/Referer headers. Compose its numeric/lazy-configuration fixes with PR #15's configured-origin allowlist, retaining per-call Stripe key validation. Added actual-router regressions for hostile Origin/Referer, absent production origin, removed keys and whitespace-only keys. Product/authentication checks remain in front of checkout creation.
- OAuth state uses a host-prefixed cookie on TLS/production to reject sibling Domain-cookie injection. Reproduction and browser evidence are in the adjacent OAuth receipt.
- Preserve PR #22's numeric service/tests, canonical private-engine pin and proof preconditions. PR #19's router/config test content was already present in PR #22; PR #15 was not its ancestor.
- Use local system serif, sans and mono stacks. Remove Google Fonts links/preconnect; restrict font-src to self in both Express and Vercel CSPs. Preserve script hashes and unrelated directives. Source/built guards fail on external font dependencies, symlinks and missing/metadata-only builds; source-only prebuild permits replacing a stale build.
- Force LF for client/index.html so Windows Git conversion cannot invalidate inline-script CSP hashes. Both hashes match both policies after building.

## Executed validation

Native Windows; Node 24.16.0, pinned pnpm 10.4.1, TypeScript 5.9.3, Vitest 3.2.7, Vite 7.3.6. Locked dependencies installed with lifecycle scripts disabled.

- Full Vitest: 211 passed, 3 MySQL durability tests explicitly skipped. Final repeat after font/CSP changes passed the same totals.
- Native promotion/admission/private-proof tests: 177 passed, 1 documented Windows canonical-path case skipped.
- Font-policy tests: 8 passed, zero skipped.
- Emitted Stripe webhook runtime closure: PASS.
- TypeScript no-emit, production Vite/CSP/esbuild build, built public-client boundary, source and built font checks: PASS.
- Chrome 155.0.8059.85: desktop 1440x1000 and mobile 390x844, routes /, /audit and /packs. Zero font requests, no horizontal overflow or runtime errors; homepage screenshots inspected. System typography and CTAs are readable. A loopback static fixture supplied the actual CSP, returned anonymous auth and blocked external resources, including existing CloudFront hero images. This is layout/font verification, not a complete live-site check.

The native engine test used canonical private source commit 51174ceb9e07b9b041b80addc14671265d7aa8ba, source SHA-256 093e847404253fac210d958f07ed2e3f8ae56a51dabbff323d79efb31dac684a, compiled outside this public checkout. The existing pin verifier accepted it. No private source is included here.

## Remaining qualification

MySQL was unavailable: Docker's Linux engine named pipe was absent. No production DB was used. Local checks are not authenticated GitHub private CI, exact-head integration proof, customer acceptance or release approval. All existing documentation and proof gates remain required. Analytics placeholders were unset and the existing large-chunk build warning remains. No marketing/legal claim audit was performed.
