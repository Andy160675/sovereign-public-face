# Promotion Fix — numeric checks and remaining limits

## Bounded repairs

Numeric comparison preserves the normalized value and the number of occurrences
of every number. A set could not detect an invented second use of a value:
`Doors open at 7.` became `Doors open at 7; last entry 7.` while retaining the
same set. Added or removed numeric mentions produce `CHECK_FAILED` before an
order or checkout is created. Existing time normalization, such as `7pm` and
`7 p.m.`, and the separate currency-amount check are preserved.

The occurrence requirement is conservative. Combining duplicate numeric
statements, adding a harmless repeated mention, or removing numbered-list
markers can be refused even when a human considers the meaning equivalent.
This guard detects changed mentions; it does not establish semantic equivalence.

The anchor comparison distinguishes a bare list connector from item context.
In `It costs £6 for coffee and £8 for pastry.`, swapping the intact item-price
pairs previously created a false cycle between `it/costs` and `and`. The rule
omits only a sole `and` or `or` between consecutive completed `for`/`per`
bindings, in the same sentence, with different tied nouns. An optional English
article `a`, `an` or `the` precedes the tied noun without becoming its identity.
Before omitting any connector anchor, the entire list from its first figure to
the sentence end must contain only those bindings and bare connectors, ending
after the final tied word. Intermediate and trailing qualifiers retain the
previous behavior; an inclusion such as `with ice cream` cannot be assumed to
apply to every item. Ranges containing `from` or `between` and mixed `and`/`or`
grouping retain the conservative connector behavior.

Additional finite checks bind a literal label plus its first bare integer to
the subsequent figures in the same clause. This distinguishes `Room 1` from
`room 2`, and `Table for 2` from `table for 4`, before comparing their capacities
or times. Intact clauses can be reordered and their connecting predicate can
be reworded while these literal identities and values remain bound. This does
not infer entity identity for unknown labels or arbitrary translated forms.

Explicit old/new currency roles are compared when both texts use recognized
`was`/`now` or `reduced from ... to ...` forms. Ordinary `from`/`to` wording does
not acquire an invented old/new role. If the ordered normalized figures are
permuted and every concrete source word binding has disappeared, the draft is
refused rather than treating wholly renamed items as a proved match. A finite
set of grammatical frame words is omitted for this test, while the previously
tested adult/adults and child/children aliases are retained.

## Reproduced cases and controls

The donor-only adaptation accepted the four incorrect drafts below when finite
synthetic worker and checker fixtures approved them. Fresh service-level
controls demonstrated these misses before repair. The prepared repair refuses
each with `CHECK_FAILED`, stores no order and makes no checkout request.

| Class | Source | Incorrect draft now refused |
| --- | --- | --- |
| Numbered entity | `Room 1 sleeps 4, room 2 sleeps 6.` | `Room 1 sleeps 6, room 2 sleeps 4.` |
| Quantity-qualified label | `Table for 2 at 7pm, table for 4 at 9pm.` | `Table for 2 at 9pm, table for 4 at 7pm.` |
| Renamed bindings with a price permutation | `Coffee £6, pastry £8.` | `Espresso £8, croissant £6.` |
| Rephrased old/new state | `Was £20, now £15.` | `Reduced from £15 to £20.` |

The valid article-led reorder `It costs £6 for a coffee and £8 for a pastry.`
to `It costs £8 for a pastry and £6 for a coffee.` is accepted. Controls also
preserve intact numbered-entity clause reorders, predicate rewording, recognized
price-state rewording, tested plural aliases and an order-preserving English to
Spanish translation. Real article-list price swaps, trailing qualifications,
range wording and mixed conjunctions remain subject to their refusal controls.

## Current adaptation and validation scope

This adapts proposal #20 onto main
`e52275d46a93f29194a0d5876a6aa40cbd06c0a6`, then adds the bounded repairs above.
That main snapshot did not contain the earlier figure-anchor helpers, so the
complete donor helper block is retained. The domain service from its exported
factory onward, including payment verification, receipt creation, webhook
reconciliation, production checkout hold and simulation boundaries, remains
byte-identical to that snapshot. All current and donor service tests are
retained. The original donor-only patch and its evidence are preserved separately.

Fresh validation used Node 24.16.0 in an owned snapshot. The expanded donor
service tests against unchanged main produced 34 failures out of 110. The
donor-only service/adapter/HTTP suite passed 135/135. The 21 additional semantic
controls produced 10 failures before the new repairs; afterwards the combined
service/adapter/HTTP suite passed 156/156, with no tests skipped. The separate
lazy-checkout controls passed 6/6 using the real Stripe SDK constructor and only
the existing unit network boundary replaced. These finite synthetic checks do
not qualify a live model, provider or customer meaning judgment.

The exact current lock was restored with pnpm 10.4.1 using a frozen lockfile
and lifecycle scripts disabled. Full application typecheck, source boundary
check, client and server production builds, and built-client boundary check
passed. The client build reported the existing analytics script placeholder
and large-chunk warnings. The canonical private ReceiptEngine source was
retrieved through the documented current route and compiled with the unchanged
preparer and TypeScript 5.9.3; its output matched the current engine pin. This
is local component evidence. The unchanged webhook/MySQL integration suite and
authenticated private CI proof for the eventual exact public head remain
separate qualification work. No service was started or deployment performed.

## Remaining limits

These are finite structural checks, not a general meaning verifier. A draft
that wholly renames items while retaining the same figure order still depends
on the existing worker/checker obligation to reject unsupported specificity.
A translation or rewording that also reorders figures and loses all reliable
bindings can be conservatively refused; no target-language bypass is added.
Only recognized literal composite identities and explicit price-state forms
receive the additional comparisons. No general synonym or entity dictionary
is inferred.

Multiword ties, repeated tied nouns, partly explicit lists and qualifications
outside the recognized list grammar can still be refused. The range and
mixed-conjunction restrictions remain. No claim of zero false refusals,
complete swap detection, independent business qualification or release
readiness follows from these repairs. Production checkout remains **HOLD**
until the separate authority and release gates are satisfied. Customer delivery
and qualification of the eventual integrated source remain separate obligations.
