# VIPFish commercial controls v1

## Purpose and boundary

VIPFish gets useful work done with AI and digital tools so customers save time and money while keeping the decisions. This module implements the October 6 commercial amendments: distribution evidence, bounded return guarantees, funded aggregate exposure, zero routine founder work and calibrated experiment decisions. It does not turn the portfolio into an audit, impose a price floor or require a call.

This is executable **offline assessment**, integrated with the acquisition reporter in PR #18. It is not a live commercial executor. Every result has `authority: NONE`, `executionAuthorised: false`, `cashChanged: false`, `termsChanged: false`, and `founderTasks: []`. It cannot send, post, charge, refund, allocate live capacity or change an order. Existing customer terms, payment routes, prices and production settings are untouched.

Run on Node 22, without dependencies:

```sh
node --test tests/diagnostic/commercial-*.test.mjs
node tools/diagnostic/commercial-controls.mjs tests/diagnostic/fixtures/commercial.synthetic.json
```

The fixture is wholly synthetic. It demonstrates a permitted partner route, a supplied qualified automated worker, a EUR 100 work fee with EUR 10 third-party investment, and EUR 150 measured benefit. That is a test calculation, not a customer result, legal approval or available business cash.

## Interfaces

- `bindingHash(payload)` returns SHA-256 of recursively key-sorted JSON. Array order is preserved.
- `assessCommercial(controls)` validates the input and returns the commercial assessment.
- `await analyseCommercial({ acquisition, controls })` composes the existing `analyseAcquisition(acquisition)` result without altering it. `acquisition: null` supports control-only operation. When supplied, currency and snapshot date must match. The acquisition bank-movement report is NEVER substituted for a reconciled treasury balance.

CLI input is a regular UTF-8 JSON file, at most 2 MiB. Symlinks on platforms providing O_NOFOLLOW, directories, invalid UTF-8, malformed JSON, unsupported fields and oversized files are refused. Exit 0 means an assessment was produced (it can say STOP); 1 means invalid/unreadable input; 2 means usage error. Errors do not echo input data or paths. Importing the module performs no CLI work.

## Input contract

The synthetic fixture and strict validator are the complete machine-readable field examples. Root fields are exactly `schemaVersion`, `asOf`, `currency`, `evidence`, `distribution`, `capabilities`, `jobs`, `treasury`, `experiment`. Version is `1.0.0`; currency is EUR, GBP or USD. Money is nonnegative integer minor units, maximum 1,000,000,000 per field. Explicitly nullable treasury/measurement fields remain unknown, not zero. Opaque IDs use ASCII letters, digits, underscore or hyphen, maximum 64 characters. Do not supply customer names, addresses, contact details or patient records.

All dates are ISO business-local dates (`YYYY-MM-DD`). The importer must convert instants to the accepted business calendar before export. The current short-cycle contract models Atlantic/Canary, Europe/London or UTC, with an explicit holiday-date list. No implicit locale conversion is performed. Endpoints are exclusive at the start of the stated date. Unrelated calendars or contract versions need their own reviewed adapter, not reinterpretation of existing contracts.

### Evidence

Each evidence row has `id`, `kind`, `status`, `purpose`, `subjectId`, `payloadHash`, `recordedOn`, `validUntil`.

| Kind | Status and meaning |
|---|---|
| `verified_rule` | `recorded`; asserted authoritative rule, not an observed business result |
| `observed_result` | `recorded`; supplied measured record |
| `external_benchmark` | `recorded`; external study, not VIPFish performance |
| `hypothesis` | `recorded`; a test proposition |
| `contractual_commitment` | `draft`, `offered` or `accepted`; a promise, never proof it was delivered |

Admission requires the correct kind, status, purpose, subject, exact payload hash and valid date. A benchmark, draft offer or wrong-purpose receipt cannot substitute for measured value, consent or accepted terms. Current readiness uses `asOf`; accepted historical terms use `acceptedOn`, so later expiry does not erase obligations. Closed interruption evidence can be recorded when resolution is observed; the native evidence store must retain the original notice and subsequent resolution, rather than silently rewriting history.

**The evaluator checks consistency, not authenticity.** A caller can fabricate matching records and hashes. A trusted upstream importer must authenticate source records, actor identities, permissions, review independence, consent scope, policy versions and financial authorisation. Different actor IDs alone do not prove independent review. No output is a cryptographic receipt or an execution permission.

### Distribution

Partner rows need a named/reachable contact, an observed `contact_permission` record and accepted `distribution_agreement`, bound to the same partner payload. An address in a directory or an old message is not sufficient input evidence. Owned channels need a `publishing_permission`; their business-relevant reach requires a separate `audience_reach` observation.

Connections do not establish reach. Unknown reach stays null; measured zero stays zero. Reach subtotals can overlap across channels and are not unique buyers. The stage is `EVIDENCED_ROUTE` only when an eligible partner or positive observed reach exists; otherwise `BUILD_DISTRIBUTION`. No revenue forecast is generated. Public referral invitations/proof posts are preparation options, not automatically published output. No cold-message route is implemented.

### Capability and capacity

A capability binds an exact artifact, producer, verifier, measured human/founder intervention and available capacity in a `qualified_capacity` record. Positive planning capacity requires zero routine human and founder minutes, different producer/verifier IDs, and a current matching record. Missing evidence yields zero slots and never creates a founder task. Pending accepted jobs must fit the remaining capacity of their requested capability, not an unrelated worker.

Capacity and evidence are snapshots, not live reservations. The native execution host must atomically recheck and reserve capacity before a new job; repeated reports cannot create reservations. Existing canonical lifecycle and effect authority remain controlling.

### Guarantee

Terms are immutable input snapshots, bound to an accepted `job_terms` record. They specify version, currency, fee, third-party/customer investment, measurement method and baseline, value metric, customer obligations and disclosed exclusions. Draft jobs (`acceptedOn: null`) remain `DRAFT_NOT_OFFERED`; an accepted job with missing/changed evidence is `CONTRACT_UNVERIFIED`, not silently a new contract.

This v1 evaluator implements only the proposed short-cycle defaults:

- 14 calendar-day measurement window from verified activation with inputs, access and baseline ready.
- Five working-day customer cure, bounded by seven calendar days of aggregate pauses, using the agreed holiday calendar. Separate pauses cannot reset the limit. Supplier-caused interruptions add no time. Missing/late recovery ends further work without inventing an earned fee.
- A fee decision/refund due date seven calendar days after measurement endpoint or early termination; earlier demonstrated value permits earlier settlement. A due date is not a claim that a refund has been executed.
- Remedy under this additional commercial guarantee capped at the agreed work fee. Third-party costs must be separately disclosed and customer-authorised. They are excluded from that fee refund but INCLUDED in total investment.
- Accepted terms must preserve mandatory rights and agreed customer obligations. This module does not purport to cap all legal liabilities or approve contract wording.

Allowed metrics are incremental profit, cost saved and explicitly noncash time value. Inputs must already be net, attributed and free from double counting. Appropriate customer implementation costs and nonrecoverable taxes belong in the investment. Forecast sales, hypothetical enquiry value, quality scores and gross revenue are not permitted metric types.

A result needs the agreed metric, baseline and method, an exact result hash, passed quality and a separately identified verifier in a bound `measured_checked_value` record. A quality pass alone earns nothing. Demonstrated benefit must be STRICTLY GREATER than the original fee plus third-party and customer costs. Waiving the fee does not lower the denominator to manufacture ROI. Late evidence cannot undo a guarantee deadline. A result during an interruption cannot earn a fee.

`VALUE_DEMONSTRATED` reports the supported fee and unpaid balance, not cash collected. Otherwise the outcome remains measuring/awaiting inputs or becomes `WAIVE_FEE`/`REFUND_FEE`. Previously refunded fees cannot be re-earned through this evaluator. `pay_after_value` is the recommended mode; collecting before demonstrated value is a STOP finding. Prepaid terms require protected refundable cash. Actual receipt history, refund fulfilment, disputes, mandatory rights and live payment actions remain the native host's responsibility.

### Treasury and month-one exposure

A complete, current `reconciled_risk_budget` observation and a separate accepted `risk_budget` commitment are required. Provider availability, bank movements or speculative receivables are not reconciled company cash.

```text
free cash = cleared company cash - essential outgoings - other customer/refund reserves
            - other committed costs - protected runway - this cohort's refund reserve
available loss capacity = max(0, min(free cash, authorised month loss cap - loss already spent))
open worst case = sum(unspent job cost ceilings) + unspent acquisition cap
additional loss capacity = max(0, available loss capacity - open worst case)
```

Refund exposure is collected less already-refunded work fees for jobs without demonstrated value, including unverified contracts. It must fit the reserved cash and authorised aggregate refund ceiling. Declared reserves cannot exceed real cash after protected commitments. Reserves cannot also fund advertising/delivery. Unspent cost ceilings stay reserved until the authoritative cost ledger clears them, even when a guarantee decision has closed. No retrospective cancellation of real liabilities occurs.

Missing fields, stale/mismatched records or unaccepted budgets return UNVERIFIED and zero additional funded exposure, not zero existing liability. All-fail cost estimates and refund reserves are distinct controls. Other liabilities and other cohorts must be included in the designated treasury fields without double counting. Reporting does not reserve or release money; authoritative host transactions must enforce concurrent admissions.

### Experiment decisions

Precedence: **STOP** for messaging/claim/data/fulfilment/guarantee incidents, unfunded existing refunds or premature collection. **PAUSE** new commitments in this assessed batch when cash/capacity/evidence/spend limits fail. **CHANGE_HYPOTHESIS** only for a bound repeated-specific-finding record with complete tracking and a closed window. Otherwise **OBSERVE**. A batch pause is not a company-wide shutdown or a founder assignment.

There is no fixed reply benchmark, ten-contact kill rule or automatic scale/spend action. `(1-p)^n` is reported only for a supplied hypothetical independent per-contact probability. It is labelled a hypothesis, not a measured rate, power calculation or proof of market rejection.

## Verification and deployment

`COMMERCIAL_VERIFICATION.json` records maker tests and hashes. Existing acquisition source/manifests and independent-review claims are preserved as historical records; they do not qualify this amendment. New feature tests run under the existing `tests/diagnostic/*.test.mjs` CI glob. No dependency, deployment, checkout, pricing, live content or canonical state-machine change is included.

Live operation still needs authenticated importer bindings, current distribution/consent evidence, funded treasury/capacity reservations and native execution integration. These are not substituted with booleans supplied by a public form. No production release or independent P95 assessment is claimed.
