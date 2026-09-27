# Josh full fight pack brief intake (prepared, held)

This code is a bounded intake state machine for `VF-2026-003` and
`josh_full_fight_pack_v1`. It is **not deployed or sending**. It does not
turn the Stage-4 `RECORDED_ONLY` Stripe webhook, a £15 match, or a customer
browser return into payment admission. Promotion Fix is a separate product.

## Admission and storage boundary

`createFightPackBriefIntake` requires an injected `admissionStore` with
`getBinding(orderRef)` and `getAdmitted(orderRef)`. The latter must read the
durable, qualified `fight_pack_paid_admissions` row created by the exact
payment admission path. The service checks order, product, receipt and
customer contact again. It never accepts a caller supplied `PAID_BOUND`
object. Call `queue({orderRef:'VF-2026-003'})` only from a trusted post-admission
worker, not a public route.

Apply `server/fight-pack-brief-schema.sql` only **after** the admission schema
in the same approved PostgreSQL database. The FK means a request cannot exist
without that admission. `createFightPackBriefStore({sql})` expects a trusted
parameterized PostgreSQL `sql(query, params)` operation. No production
database binding or credentials are in this change. The existing Stage-4
MySQL receipt journal and Promotion Fix Neon store are separate; no atomic
cross-store outcome is claimed.

`queue` is idempotent on `order_ref` and stores `HELD_TRANSPORT` with no link
token. It records a typed operational stop through the supplied append-only
`stops.record` sink. The sink must be provisioned; failures hold the effect.
The customer email remains in the protected binding and is never put in the
stop receipt or brief queue.

## Future controlled dispatch

There is no HTTP dispatch route, mail adapter, or customer form in this
change. Do not connect a live transport until the customer form at
`/fight-pack-brief.html`, its POST endpoint, an approved mail sender with
provider-level idempotency, stop journal, and recovery monitor are verified.
The trusted internal `dispatch` port then claims the request atomically,
generates a random 256-bit token, stores only its SHA-256 digest and expiry,
and passes a fragment link to the sender. A timeout or error becomes
`DELIVERY_UNCERTAIN`; there is no automatic resend. If the process dies in
`DISPATCHING`, the independent monitor must hold it for reconciliation.

`submit` expects a token passed in a request body, not a query string. It
accepts one bounded, nonempty, explicitly confirmed brief via a conditional
database update; the token is consumed and the brief cannot be replaced.
An expired token is refused. Customer supplied brief text is stored only in
the protected database, never in operational stop receipts. Production and
delivery remain separate held stages until their own authority and evidence
are in place.
