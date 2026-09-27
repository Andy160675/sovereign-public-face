# Paid-order operational stops (draft)

`server/operational-stop-log.ts` appends `ops.stop` receipts to the existing
JARUS ReceiptEngine chain in the provisioned Stripe receipt connector. An
`OPEN` receipt contains an opaque local UUID, UTC time, stage, category, fixed
cause code, next effect held, owner, recovery code, expected exit check and
zero or more safe evidence pointers. An empty list states that no safe source
pointer was available; it must not be filled with invented proof. `RETRYING` and `RESOLVED` are new receipts; prior links
are never edited. Resolution requires an evidence pointer. A resolved gap that
recurs cannot silently reuse its old stop.

The Stripe receiver now opens stops atomically with configuration SAFE,
authenticated connector holds and refused paid admission. A signed paid
Checkout event recorded as `RECORDED_ONLY` opens
`PAID_ADMISSION_NOT_CONFIGURED` and holds intake. If the stop append fails,
the transaction rolls back and the handler returns 500 rather than a success
acknowledgement. Unauthenticated signature failures remain in the existing
delivery/signature receipt trail; they cannot establish a customer order.

The order service must inject `stops.record(...)` as a required effect and
open a `BRIEF_MISSING` or `INTAKE_REQUEST_FAILED` stop before advancing when
the buyer's brief cannot be obtained. Its private order ledger holds the map
from opaque stop correlation to the order. Never put names, email addresses,
Stripe IDs, raw webhook bodies or arbitrary error text in `ops.stop` or a
public GitHub issue. Supported evidence pointers are `issue:<number>` or a
SHA-256 receipt, check or deployment digest.

For reconciliation, derive a stable SHA-256 gap key from the provider account,
mode and event ID inside the private worker, then use `opaqueUuidFromHash` for
the stop and correlation IDs. A repeated gap writes once; a changed assertion
using the same ID fails. This does not fetch provider events by itself.

**Coverage boundary:** no receiver can observe a webhook that Stripe never
sends. If the receipt database is unavailable, it cannot write a stop to that
same database. An independent provider-to-receipt reconciliation worker with
its own failure alert is required to catch both cases. This draft has no live
destination, credentials, database qualification or production deployment.
