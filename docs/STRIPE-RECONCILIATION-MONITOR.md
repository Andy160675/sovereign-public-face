# Stripe receipt gap detector (prototype)

`server/stripe-reconciliation.ts` scans a **fixed**, inclusive/exclusive UTC
event-created interval within the last 29 days. It checks the current account
authenticated by a dedicated Stripe read key against the configured merchant
account ID, checks the key's live/test prefix, and checks each event's mode and
connected-account scope. It queries paid one-time Checkout Session completion
events and looks up each exact Stripe event ID in the configured receipt
connector. It reports absent IDs with a deterministic SHA-256 gap key.

The caller must supply the exact Ltd `accountId`, `connectorId`, `mode`,
`from`, `to`, `now`, a `ReceiptJournal`, and a read provider created from a
dedicated key. There is no default account, key, connector or mode. The scanner
never charges, refunds, admits payment, identifies an order by amount or stale
metadata, grants access, sends a brief request, or delivers files.

For an operational run, supply `onGap: createReceiptGapStopWriter(journal,
connectorId)`. This writes an opaque, idempotent `ops.stop` receipt in the
same connector, with only a digest as evidence; it does not store Stripe IDs
or customer details in the stop. Persist the returned
cursor only after that callback succeeds. If a page has more results after the
page bound, resume **the same interval** with `startingAfter`. Keep the
interval and cursor in a durable scheduler; this module intentionally does not
claim that such a scheduler or a production journal is deployed. An empty
page with `has_more`, provider scope mismatch, journal failure or stop-write
failure aborts without yielding an advanced cursor.

Stripe's Events list covers the last 30 days. This detector caps its input at
29 days and requires a five-minute settlement lag before the upper bound.
That finite retention cannot recover older events or prove that every payment
was observed; separately compare Stripe payments to order bindings and review
any unresolved gap. A found receipt may be `held` or `refused`; it means the
webhook reached the journal, **not** that the order was admitted or fulfilled.

Primary API references: [Events list](https://docs.stripe.com/api/events/list),
[Event object](https://docs.stripe.com/api/events/object),
[Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object).
