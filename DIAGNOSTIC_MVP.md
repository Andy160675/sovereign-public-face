# VIPFish adaptive diagnostic — review candidate

**Status: implemented MVP; draft review only. Not deployed, not P95-qualified, no live payments.**

The core flow is pain → relevant questions → explained recommendation → portable brief. It uses deterministic, inspectable rules, not a model call or claimed psychological buyer profiles.

## What is included

- Six questions for an identified problem; seven when clarification is useful; two for an unresolved/free-help exit. Three provisional segments: enquiries, repetitive admin and inconsistent work.
- Free snapshot (£0), Teardown (£250), Signal Audit (£750), all **recommendation-only**. Unknown evidence/scope/detail or no request for paid help returns free help. A broad audit additionally requires measured evidence and several connected processes.
- Native keyboard-operable radio controls, back/reset, explained results, explicit limitations and a downloadable unsigned JSON brief. An ordinary `/contact` link carries no answers.
- Strict offline, de-identified CRM-export reporting. It separates fees/refunds/costs, closed-sale conversion, open pipeline and customer outcomes. It neither ingests a live CRM nor learns/changes production routing.
- A dependency-free Node test workflow; a separate local-only Python browser smoke test for use where browser execution is permitted.

## Preview and test

From the repository root, in an authorised development environment:

```sh
node --test tests/diagnostic/*.test.mjs
python3 -m http.server 8080 --bind 127.0.0.1 --directory client/public
# Visit http://127.0.0.1:8080/diagnostic/index.html
```

Use the **explicit `/diagnostic/index.html` URL**, not a root-level SPA route. Vite's existing public-directory configuration copies the four files into the production output. The only existing file changed is `vercel.json`: four exact static-file exemptions precede the SPA catch-all. Every pre-existing configuration value and route is preserved. Hosting behaviour and MIME types still require preview verification.

Browser smoke test (Python Playwright and Chromium must already be available):

```sh
python tests/diagnostic/browser_smoke.py --output /tmp/vipfish-browser-evidence
```

This checks real navigation, keyboard/back/edit, all three offer tiers, downloads, reset, narrow-screen overflow and absence of unexpected network activity. **It has not passed in the build environment**: the first localhost navigation returned `ERR_BLOCKED_BY_ADMINISTRATOR`. The attempt was stopped; browser policy was not modified and no alternate access route was attempted.

## Offline CRM reporting

Export only the explicit schema below from an authorised data source. Deliberately replace opportunity IDs with pseudonyms first. Do not supply names, email addresses, raw notes, sensitive traits or any other fields. This is schema restriction, not an automatic anonymisation tool.

```json
{
  "schemaVersion": "1.0.0",
  "currency": "GBP",
  "records": [
    {
      "opportunityId": "synthetic-001",
      "segment": "enquiries",
      "sale": "won",
      "feeMinor": 25000,
      "refundMinor": 0,
      "acquisitionMinor": 2000,
      "sellingMinor": 3000,
      "deliveryMinor": 8000,
      "customerOutcome": "improved"
    }
  ]
}
```

```sh
node tools/diagnostic/analyse-crm.mjs deidentified-export.json > aggregate-report.json
```

The example is synthetic, not an actual customer result. Include won, lost and open opportunities, not just buyers. `segment` is `enquiries|admin|quality|unknown`; `sale` is `won|lost|open`; `customerOutcome` is `improved|unchanged|worse|unknown`. Non-won records have zero fees/refunds and an unknown customer outcome. Fees and all costs are supplied GBP minor units, integers from 0 to 1,000,000,000; refunds cannot exceed fees. Maximum 5,000 records / 2 MiB; duplicates and unknown fields fail closed. IDs must be pseudonymous alphanumeric/underscore/hyphen strings, 1–64 characters.

`winRateClosed = won / (won + lost)`; no closed records means `null`, not zero. `contributionMinor = fees − refunds − acquisition − selling − delivery`. Contribution per opportunity includes every supplied opportunity and its costs; it is descriptive, not predicted lifetime value, company profit, cleared cash or causal ROI. Report customer outcomes separately: a profitable sale can still have a poor customer result.

## Evidence and release boundary

Local Node v22.16.0 verification: **49 tests passed, 0 failed**, including exhaustive traversal of **3,457 legal terminal answer paths**; module syntax checks passed; Python smoke-test syntax parsed; pre-existing Vercel settings compared equal after removing only the four additions. Tests use synthetic data only. See `DIAGNOSTIC_VERIFICATION.json` for exact source hashes and limitations.

This was an additive source snapshot in an isolated container, not a full repository checkout. GitHub was read/written through the authorised connector; direct git/network access was unavailable. The full repository test/build was **not run locally**. The existing public-client workflow and new feature workflow are expected to run on the PR, but their results must be read separately; this document does not claim they passed.

No deployment, ad launch, CRM export, checkout call, subscription, order creation or customer message occurred. No API keys or dependencies were added. No existing payment HOLD is lifted. Customer briefs are mutable unsigned files, not independent custody receipts or canonical orders.

**Outstanding before release:** full-repository CI/build, browser/visual and hosting acceptance, a genuinely independent review of the frozen candidate under the governing QMS, and explicit commercial/seller/payment authority for any later purchasing integration. P95 is **NOT ASSESSED**, not an inferred 95 because tests passed. This MVP does not include trained archetypes, paid-ad attribution, automatic CRM ingestion, Stripe dispatch or autonomous outcome optimisation.

Review the spec and plan in `docs/superpowers/`. The viral FTC/Hims claims and the asserted named “JEV” model were not verified and are not used as product evidence or marketing copy.
