# OAuth state cookie audit — 11 November 2026

Source baseline: PR #15, `2102de082193c9899c66e18b717a59d317ff72cc`.
Scope: the OAuth nonce cookie on the Express host. No provider, customer, payment or production operation.

## Finding and correction

The PR protected the session cookie with a host prefix, but still accepted an unprefixed `oauth_state` nonce. An attacker controlling a sibling under a parent domain that permits Domain cookies can plant that cookie, then supply its own captured callback with the same nonce. HttpOnly does not prevent another server from setting a Domain cookie.

The exact original callback accepted the synthetic attacker code (302, token exchange called). The corrected callback rejects the legacy cookie before exchange (400). TLS and production now use `__Host-oauth_state`, Secure, Path=/, no Domain, with no fallback to the legacy name. Plain HTTP development retains the separate legacy name. Name and options share the session cookie's existing TLS predicate.

In-flight sign-ins begun with the old cookie must restart once after deployment. Existing session cookies are unchanged. The original PR's deployment, configuration and private integration gates remain open.

## Reproduced evidence

- Node 24.16.0 / native Windows, actual source handlers loaded through Node's TypeScript stripping: **5/5 pass**. The original baseline produced **2 failures and 3 passes** with the same probe. Covers planted legacy nonce, cookie attributes, genuine production flow, wrong protected nonce and genuine HTTP development.
- Installed Chrome, isolated temporary profile, local synthetic HTTPS hosts only: legacy sibling Domain cookie reached the app; forged host-prefixed Domain cookie was rejected; genuine app host-prefixed cookie was accepted. **PASS**. This tests browser cookie rules on `audit.test`, not any live hosting provider's domain configuration.
- Existing native promotion service and adapter suites: **57 passed, zero failed/skipped**.
- Three permanent Vitest regressions added. Full Vitest/typecheck results are recorded separately below when available.

Reproduce the dependency-free handler probe with Node 24:
```text
node docs/verification/2026-11-11-oauth-state/handler-probe.mjs <absolute-checkout-path>
```
It loads the actual OAuth, nonce, cookie, public-origin and constants modules. DB/provider boundaries and the cookie parser are synthetic; no real token exchange occurs. The parser only handles the synthetic ASCII cookie fixtures.

The Windows browser probe uses installed Chrome and Git OpenSSL, an isolated temporary profile/certificate, a loopback-only HTTPS server on port 18443, and local host mapping:
```text
node docs/verification/2026-11-11-oauth-state/browser-probe.mjs
```
It makes no application/provider calls. It does not alter an existing browser profile.

## Limits and retained failures

A cloud Chromium attempt could not start because its process singleton socket was denied; the native Chrome probe above supplied browser evidence.
The first offline locked install lacked `fast-xml-builder@1.3.1`; the earlier wrong global pnpm invocation also could not satisfy the cache. No lockfile or dependency versions were changed.
The HTTP suite initially could not import `@upstash/ratelimit` before dependencies were available. That was an environment failure, not a test pass.
This bounded fix does not establish full-repository, live OAuth, database/private-engine, customer-acceptance or release qualification.

## Locked dependency validation completed

Pinned pnpm 10.4.1 installed the unchanged lockfile with lifecycle scripts disabled. Runtime: Node 24.16.0, TypeScript 5.9.3, Vitest 3.2.7; browser: Chrome 155.0.8059.85.

- OAuth/return-origin/logout: **48 passed** (24 + 23 + 1), zero skips.
- Session host-cookie/rate-limit/mount: **75 passed** (13 + 49 + 13), zero skips.
- Expanded promotion service/adapter/HTTP run after dependency installation: **67 passed**, zero skips.
- `tsc --noEmit`: exit 0.
- `git diff --check`: exit 0.

Commands use `node node_modules/vitest/vitest.mjs run <named-test-files> --maxWorkers=1 --minWorkers=1`; native tests use `node --test server/promotion-fix-{service,adapters,http}.test.mjs` (expand the three paths in PowerShell). These are scoped regressions, not authenticated private CI or the MySQL durability suite.
