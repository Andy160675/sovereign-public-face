# VIPFish acquisition measurement

Offline measurement for the free hero page → relevant service → paid outcome journey. This extension follows the diagnostic source candidate in [PR #17](https://github.com/Andy160675/sovereign-public-face/pull/17), without changing its browser privacy, recommendations or payment routes.

## Run it

Node 22 or newer; no package installation, credentials or network access required.

```sh
node tools/diagnostic/analyse-acquisition.mjs tests/diagnostic/fixtures/acquisition.synthetic.json
node tools/diagnostic/analyse-acquisition.mjs acquisition-export.json > acquisition-report.json
node --test tests/diagnostic/*.test.mjs
```

The included fixture is entirely synthetic. Its identifiers, comparison values and financial amounts are examples, not VIPFish results or recommended advertising benchmarks.

The module also exports `analyseAcquisition(document)`. An existing authorised importer can call this pure function directly. The CLI reads a bounded local JSON file and emits JSON; it does not collect events, authenticate processor exports, launch advertising, move money or change routing.

## Input contract

The fixture is the complete example of schema `1.0.0`. Use one currency and one campaign cohort per document. Produce separate documents for different currencies or attribution definitions. Do not add currencies together without an explicit, separately evidenced FX conversion.

| Section | Required meaning |
|---|---|
| `cohort` | Opaque cohort/campaign IDs, channel, currency, exposure period, observation date, whether tracking is complete and the attribution window is closed. |
| `traffic` | Impressions, link clicks and advertising spend for that same campaign/exposure period. `null` means unknown; zero means an observed zero. |
| `pages` | One row per distributed page, with a pseudonymous business ID, furthest observed stage and independent free-page acceptance flag. Include pages that never produce a sale. |
| `payments` | One latest normalised payment snapshot per paid order or pending/failed attempt. Stable payment IDs and evidence references prevent duplicate import. Link it to its attributed page. |
| `costs` | All supplied page creation, distribution, selling, delivery, processing and support costs, including spending on nonbuyers. Assign a page where supported; leave common campaign costs unallocated. |
| `costsComplete` | An explicit assertion by the exporter that all relevant variable acquisition and fulfilment costs for these pages and orders are included, including committed delivery work. Unknown costs must not silently become zero. |
| `cashEntries` | Actual bank credits/debits allocated to this cohort, supported by distinct bank evidence references. Processor balance availability and the subsequent bank payout are not two cash receipts. |
| `cashComplete` | Whether all relevant allocated bank movements are represented. This is not the business's total bank balance. |
| `comparison` | Deliberately supplied comparison values and minimum sample counts. A `null` comparison disables that comparison. No universal platform benchmarks are embedded. |

Only the exact schema is accepted. IDs must be deliberately pseudonymised alphanumeric, underscore or hyphen tokens of 1–64 characters. Format validation is not anonymisation: do not put customer names in an otherwise valid token. Supply no names, emails, URLs, notes, questionnaire answers or raw processor payloads.

All money is an integer number of minor currency units from 0 to 1,000,000,000. The report supports GBP, EUR and USD in separate documents. Timestamps use canonical UTC ISO format, including milliseconds, for example `2026-10-01T00:00:00.000Z`. The exposure period ends no later than `asOf`; payment and bank observations must fall between the cohort start and `asOf`.

The combined ledgers are capped at 5,000 records and CLI input at 2 MiB. Duplicate payment IDs/evidence references, duplicate bank evidence, unknown page references, unsupported fields, inconsistent refunds and mixed currencies are rejected.

### Payment evidence and attribution

The exporter chooses one page/campaign attribution for each order. That allocation must come from its existing source evidence; this report does not infer a causal contribution or distribute credit across multiple channels. Keep that choice and its conversion window consistent when comparing cohorts.

A counted paid order requires a positive successful payment from `provider_export`. `webhook_observation`, pending and failed records are excluded from revenue and paid-order counts. Non-successful snapshots have zero captured amount and zero refund. A fully refunded successful payment remains a historical paid order, while retained revenue and retained-paying-business counts reflect the refund.

The input contract assumes one normalised successful payment row per order. Consolidate instalments, split captures and duplicated processor events upstream. A stable pseudonym for the original payment is required; webhook event IDs are not a substitute. For a bank payout spanning several orders or currencies, allocate it upstream using reconciliation evidence, and import each allocated bank movement only once.

**`provider_export` is supplied provenance, not verification performed by this analyser.** The output explicitly says `supplied_not_independently_verified`. This cannot turn an unverified upload into payment authority.

The existing `server/stripe-webhook.ts` records observations with `paid_claim:false`; those routine receipts cannot be relabelled as confirmed purchases to populate this report. Future automatic ingestion needs a trusted payment-outcome exporter, stable campaign/page linkage and bank reconciliation. Purchasing integration also needs to account for the checkout/OAuth fixes in [PR #15](https://github.com/Andy160675/sovereign-public-face/pull/15).

### Funnel and cost semantics

Stages are cumulative: delivered → visited → service selected → checkout started. Free-page acceptance is measured separately and never creates a paid order. A business may have several pages and several purchases; the report counts distinct paying businesses separately from successful orders. Cost per paying business equals new-customer CAC only when the cohort contains newly acquired customers; this schema does not establish prior customer history.

Direct costs are shown beside each page's revenue. Common campaign costs and advertising spend stay at cohort level. A page's revenue less its directly allocated costs is not its fully allocated profit.

Include the cost of every free page and its distribution, including unsuccessful outreach. Advertising spend belongs in `traffic.adSpendMinor`; do not also include it in a cost-ledger category. Cash entries are a separate bank view of economic activity already represented elsewhere, not extra revenue or extra costs in the contribution calculation.

## Reading the report

| Measure | Calculation or interpretation |
|---|---|
| CPM | Advertising spend ÷ impressions × 1,000. |
| CTR | Link clicks ÷ impressions, as a decimal. |
| CPC | Advertising spend ÷ link clicks. |
| Paid orders per click | Counted successful orders ÷ link clicks. This is an order rate, not a probability of a unique person buying. Repeat orders can make it exceed 1. |
| Average order value | Gross counted payment revenue ÷ counted paid orders. |
| Advertising CPA | Advertising spend ÷ counted paid orders. This is not total customer acquisition cost. |
| Gross / net ROAS | Gross / refund-adjusted payment revenue ÷ advertising spend. The comparison uses net ROAS. |
| Customer acquisition cost | Advertising + page creation + distribution + selling costs ÷ distinct paying businesses. |
| Contribution | Refund-adjusted revenue − advertising − all supplied variable costs. Available as a complete measure only with complete cost coverage and known ad spend. Company overhead and tax are outside this measure. |
| Bank cash movement | Allocated bank credits − allocated bank debits. Complete only when the cash ledger is declared complete; never inferred from payment success. |
| Time to first paid order | Elapsed days from cohort start to the earliest counted successful payment. This is not bank payout time or lifetime payback. |

Undefined denominators return `null`, never fabricated zero or infinity. Advertising metrics are not applied to email/organic cohorts; those cohorts declare zero advertising spend. Cohort summaries and page IDs are emitted, while business/payment/evidence/cost/bank-entry identifiers are not.

Revenue-based ROAS and profitability answer different questions. An illustrative £300 sale acquired with £100 of ads has 3× gross ROAS. With £250 of delivery cost, its contribution is −£50 before overhead. Bank cash can differ from both because collection and spending occur at different times.

## Diagnostic behaviour

Every report is descriptive. It reports evidence gaps first and never changes spend or routing.

- Incomplete tracking or an open attribution window prevents benchmark-based campaign conclusions.
- Incomplete cost coverage prevents a complete contribution or profit-based judgement.
- Comparisons require the supplied sample minimum relevant to the metric. CPA and ROAS need the specified paid-order sample; no paid orders after sufficient clicks and a closed window produces its own finding.
- A high or low metric suggests checks rather than proving a cause. CPC is examined through CPM and CTR; low purchase conversion includes traffic intent, message match, offer, page, trust, checkout and measurement.
- Sufficient evidence for a comparison is not statistical proof of causality or permission to scale. Change one testable factor, then compare like-for-like cohorts and actual paid outcomes.

## Scope and sources

This is a working offline report and integration contract. Automatic collection from hero pages, validated processor ingestion and bank reconciliation are separate integration work. No change in this extension enables those production connections.

Relevant metric definitions: [Google Ads CTR](https://support.google.com/google-ads/answer/2615875), [average CPC](https://support.google.com/google-ads/answer/14074), [conversion rate](https://support.google.com/google-ads/answer/2684489), [ROAS](https://support.google.com/google-ads/answer/6268637?hl=en-GB), and [ROI and costs](https://support.google.com/google-ads/answer/1722066). The formulas above are arithmetic derived from those definitions, with refund and cost treatment stated explicitly.

Source verification and limitations for this change are recorded in `ACQUISITION_VERIFICATION.json`. Existing diagnostic source and its original verification record remain separate.
