# Promotion Fix — numeric checks and remaining limits

## Bounded repairs

Numeric comparison preserves the normalized value and the number of occurrences
of every number. A set could not detect an invented second use of a value:
`Doors open at 7.` became `Doors open at 7; last entry 7.` while retaining the
same set. Added or removed numeric mentions now produce `CHECK_FAILED` before
an order or checkout is created. Existing time normalization, such as `7pm` and
`7 p.m.`, and the separate currency-amount check are preserved.

The occurrence requirement is conservative. Combining duplicate numeric
statements, adding a harmless repeated mention, or removing numbered-list
markers can be refused even when a human considers the meaning equivalent.
This guard detects changed mentions; it does not establish semantic equivalence.

The anchor comparison also distinguishes a bare list connector from item
context. In `It costs £6 for coffee and £8 for pastry.`, swapping the intact
item-price pairs previously created a false cycle between `it/costs` and `and`.
The correction omits only a sole `and` or `or` between consecutive completed
`for`/`per` bindings, in the same sentence, with different tied nouns. Before
omitting any connector anchor, the entire list from its first figure to the
sentence end must contain only those bindings and bare connectors, ending after
the final tied word. Intermediate and trailing qualifiers retain the previous
behavior; an inclusion such as `with ice cream` cannot be assumed to apply to
every item.

State and date wording remain part of the comparison. Sentences containing
`from`, `between`, or both `and` and `or` retain the previous connector behavior:
range interpretation and bundle/choice grouping require more than intact
item-price pairs. This is an English structural correction, not a general
language parser.

## Executed regression evidence

The three existing native suites contain 135 tests after adding 23 regressions;
all 135 passed locally. The final service-test file, exercised against the
unchanged parent implementation, produced eight expected failures. They cover
three added/removed numeric-mention cases and five intact-list reorder cases.
Both model fixtures approve everything, so the deterministic check must decide.

Regression coverage retains rejection of direct price swaps, was/now changes,
date changes, range changes and mixed conjunction regrouping. No existing test
was weakened, removed or skipped. The production checkout hold, payment and
receipt paths, prices, private ReceiptEngine boundary and model prompts are
unchanged.

Independent review of the provisional implementation found two unsafe accepted
changes: a trailing Saturday date and an ice-cream inclusion could move to a
different offer. Both were reproduced as failing regressions and the complete-
list guard corrected them before the final patch. The provisional implementation
is not an approved integration target.

## Four reproduced semantic misses remain open

All four examples below are still accepted by the deterministic check when the
worker and checker fixtures approve them. They are not covered by the repairs.

| Class | Source | Incorrect draft still accepted |
| --- | --- | --- |
| Numbered entity with repeated labels | `Room 1 sleeps 4, room 2 sleeps 6.` | `Room 1 sleeps 6, room 2 sleeps 4.` |
| Quantity-qualified repeated label | `Table for 2 at 7pm, table for 4 at 9pm.` | `Table for 2 at 9pm, table for 4 at 7pm.` |
| Item anchors all renamed | `Coffee £6, pastry £8.` | `Espresso £8, croissant £6.` |
| State anchors rephrased | `Was £20, now £15.` | `Reduced from £15 to £20.` |

Repeated labels become ambiguous in the current word-anchor map. Renaming all
anchors removes the shared words needed to establish a numeric trade. Resolving
these requires additional, independently qualified meaning or entity binding;
the current tests do not provide that proof.

## Existing false refusals also remain

The bounded connector rule does not resolve article or multiword ties, repeated
tied nouns, conjunctions beginning another sentence, partly explicit lists, or
benign phrases containing `from`. For example, this intact-pair reorder remains
refused:

`It costs £6 for a coffee and £8 for a pastry.`

→ `It costs £8 for a pastry and £6 for a coffee.`

The existing parser treats `a` as the tied word. No claim of zero false refusals,
complete swap detection, independent business qualification or release readiness
follows from these repairs. Production checkout remains **HOLD** until the
separate authority and release gates are satisfied. Full customer delivery and
private-engine CI provisioning remain separate obligations.
