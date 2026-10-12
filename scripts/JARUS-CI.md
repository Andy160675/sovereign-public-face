# Receipt dependency and webhook CI

The full suite requires a supplied canonical private engine and its reviewed
SHA-256. `pnpm run test:ci` refuses before running receipt tests if either is absent
or mismatched. The full application suite runs in the private integration workflow;
public CI tests its admission helpers and verifies authenticated proof of that
exact public commit before its build and bundle checks can pass.

The integration workflow is prepared for the existing private
`Blade2AI/codex-sovereign` GitHub Actions boundary. Its run must pass before proof
is claimed. That workflow pins the exact
public candidate commit, checks out the canonical private source at the commit in
`jarus-ci-pin.json`, and uses TypeScript 5.9.3 to compile the receipt component.
Both source and emitted entry hashes must match the recorded pins. The component
exports the same canonical ReceiptEngine; it is not a second hash implementation.

`prepare-jarus-ci.mjs` takes `JARUS_CI_SOURCE_PATH` and `JARUS_CI_OUTPUT_DIR`.
The output must be outside the public checkout. It never downloads source,
creates credentials or overwrites an existing entry. In Actions it writes the
admitted entry path and hash to `GITHUB_ENV`; the original pin wrapper then runs
the unchanged full test command. Only synthetic payment keys and disposable
database fixtures are used. Private source and compiled engine remain temporary;
the workflow uploads neither and uses no dependency cache containing them.

The integration run also provisions disposable MySQL and applies the existing
test-only receipt migration so the three durability/concurrency/restart probes
run. Build and public-bundle verification remain required checks.

The public runner receives metadata only, through the commit status context
`jarus/private-stripe-integration`. Its read-only GitHub token cannot write that
proof or access private source. The latest matching status must belong to the
exact head SHA, come from authenticated reporter account ID `214889381`, be
successful and less than 24 hours old, and link a native job in the fixed private
repository. Missing/pending proof waits at most ten minutes; malformed, stale,
untrusted or failed proof refuses. Older successes cannot override a newer failure.

Reporting is an operator step using the existing authenticated GitHub CLI, after
independently checking the native private job succeeded with the exact public SHA,
canonical engine pins, full unchanged application suite including all MySQL probes,
typecheck, build and boundary checks. Post state `success`, the context above,
the exact native job URL and description
`Machine CI: full suite, MySQL, typecheck, build, boundary PASS`.
This is machine evidence under the account's delegated authority, not a personal
human review. Every new public commit, including a main merge commit, needs fresh
private proof; rerun public CI after reporting if its bounded wait expired.
No new reporter credential is created, stored in public CI or passed to test code.
An unattended reporter would require a separately authorised credential boundary.

CI proof does not prove production deployment. Do not supply private material
to public PR jobs or public logs. No live secret, migration, connector, checkout,
fulfilment, payment, acceptance or deployment is enabled by these CI changes.
