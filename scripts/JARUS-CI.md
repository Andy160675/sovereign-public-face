# Receipt dependency and webhook CI

The public workflow requires a supplied canonical private engine and its reviewed
SHA-256. `pnpm run test:ci` refuses before running receipt tests if either is absent
or mismatched. No check is skipped, marked successful or replaced with a mock.

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

Private integration proof does not make the public named check green or prove
production deployment. The public runner has no authenticated supply route.
Adding one needs a separately configured, reviewed credential and privacy boundary;
a bare environment declaration is insufficient. Do not supply private material
to public PR jobs or public logs. No live secret, migration, connector, checkout,
fulfilment, payment, acceptance or deployment is enabled by these CI changes.
