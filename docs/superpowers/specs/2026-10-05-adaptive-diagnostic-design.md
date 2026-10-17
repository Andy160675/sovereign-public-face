# VIPFish adaptive diagnostic MVP

Authority: user approved the in-chat diagnostic/offer-routing design with “Build @GitHub”. This is an additive feature branch and draft PR only, not production, payment, CRM-export, ad-spend or merge authority.

## Outcome
Give a business owner a useful next step, with a short explanation and a portable brief, without collecting their identity, inventing savings or using a model API. Customer benefit and measured business contribution are separate outcomes.

## Design
A self-contained static page at `client/public/diagnostic/index.html`, served as `/diagnostic/index.html`, uses a pure browser-compatible ES module. Vite already copies `client/public` to `dist/public`. Do not modify existing SPA routes, checkout, secrets or package dependencies. Add four exact diagnostic static-file exemptions before the existing Vercel SPA catch-all; retain all pre-existing configuration. The exact hosting route still requires deployed-preview verification; no homepage link is added in this PR.

Ask six questions for a known problem and at most seven when clarification is needed. Unresolved problems stop at two questions with free help. Question order: pain, optional clarification, problem-specific detail, frequency, evidence, scope, desired help. Every answer changes the next question, result, evidence requirement or offer. Back/edit truncates downstream answers. All input is enum-validated and strict ordered transcripts reject injected, stale, duplicate and out-of-order values.

Three provisional problem segments: missed enquiries, repetitive admin, inconsistent work. They are explicit design hypotheses, NOT CRM-derived buyer personas or calibrated probabilities. The user can remain unclassified. Recommendations use the stated £0 Snapshot / £250 Teardown / £750 Signal Audit ladder as review-only configuration. No offer is purchasable. Recommend a paid review only for an identified, specific, recurring problem with examples or measured evidence, known scope and an explicit request for paid help. An audit additionally requires several processes and measured evidence. Otherwise offer the lower appropriate tier or free help. Urgency and inferred vulnerabilities do not influence price.

Results state self-report limitations; show the relevant evidence to collect and the exact reason for the route. No savings estimate is produced without evidence. Receipt exports are unsigned user-held JSON, not canonical orders, immutable evidence or payment proof. No persistence, tracking, third-party scripts, model, fetch, cookies or answer-bearing URLs. Contact is a normal explicit link to the existing `/contact`, with no answers attached.

A separate offline Node CLI accepts only a strict, deliberately de-identified JSON export with segment, sale outcome, money values and customer outcome. It reports descriptive per-segment counts, won/lost conversion, refunds, net contribution, contribution per supplied opportunity and customer outcomes. It does not discover latent archetypes, export the live CRM, change routing or claim causal effects. All records use GBP minor units; duplicates, nonfinite money, unknown fields and inconsistent rows fail closed. Raw records/IDs are not emitted.

## Verification and limits
Native Node tests cover the finite routing graph, state edits, validation, pricing, privacy and offline aggregation. Browser smoke tests cover mobile/desktop, keyboard, result/download and no unexpected network requests. P95 remains NOT ASSESSED until a genuinely independent review of the frozen candidate uses the governing QMS. Automated tests and a self-review cannot substitute for that receipt. No guessed score or probability.

No claim about Hims & Hers, an FTC case or a named “JEV” model is part of this feature; earlier conversational claims were not verified for use as evidence.
