# Josh full fight pack — paid admission preparation

Status: **not deployed; no live order admitted; no email or fulfilment wired**.
This is the customer-specific `VF-2026-003` product, not the public
`promotion_fix_v1` rewrite. The current checkout's `vf=VF-2026-002` metadata
is a known conflict and produces `METADATA_CONFLICT` with no admission.

## Code boundary

`server/fight-pack-admission.mjs` accepts an immutable order binding from a
protected store and reads the exact merchant account, Checkout Session, one
line item, PaymentIntent and Charge. It checks live mode, completed and paid
status, £15 GBP, the pinned Payment Link, Price and Product, customer email,
exact provider IDs and zero refunds before calling `store.admit`. Its stop
logger is mandatory. The code never creates a charge, changes Stripe metadata,
sends a message or builds a pack.

The prepared `server/fight-pack-admission-schema.sql` is a **proposed PostgreSQL
contract**, not a selected production architecture. Stage 4's receipt journal
uses MySQL. Creating a second authoritative ledger would require a proved
transactional/outbox boundary or an explicit single-store choice; neither
exists. This SQL has not been migrated or tested against a production
database. A production store
must atomically insert the first admission, return the existing row for the
same evidence, and reject any conflicting order or provider ID. The service's
injected test store is **not** a production implementation.

## Recovery for the already paid Checkout

A new webhook endpoint cannot be assumed to replay a payment completed before
it existed. A sanctioned reconciler must use the Ltd account-scoped read-only
Stripe API to retrieve the exact known Session and related objects. The old
metadata remains unchanged. Admission stays held until a **separate protected
correction receipt** records `VF-2026-002` observed, `VF-2026-003` intended,
a named authorised person, and a digest of the exact account, mode, Session,
PaymentIntent, Charge, Payment Link, Price, Product, amount, currency and
customer binding. The injected `authority.verifyCorrection` must independently
authenticate that receipt and return the matching digest. The service does
not self-issue or accept a bare assertion of correction. No such production
receipt is present in this change.

## Integration work before any live effect

1. Choose one authoritative transactional order/receipt store and prove its
   outbox semantics before adopting this proposed schema. Provision restricted
   roles; implement durable `getBinding`/`admit` with uniqueness and restart
   semantics. Keep raw provider IDs, customer email and correction receipt in
   the protected store.
2. Supply a **separate Ltd-scoped Stripe reader/key** and webhook secret. Do
   not swap the shared `STRIPE_SECRET_KEY`: Promotion Fix also uses it.
3. Wire only a verified, signed Ltd webhook to wake this reconciler. A signed
   event or `RECORDED_ONLY` receipt is not a paid-order entitlement. Add an
   operator-owned one-time recovery job for the already paid exact Session.
4. Wire the durable admission row to a once-only post-pay brief request.
   Empty checkout notes mean `AWAITING_BRIEF`, never an invented brief. The
   customer must confirm changed facts and rights before a new pack is built.
5. Separately qualify generation, independent check, hashed direct-file
   delivery and customer acceptance. The existing video factory stops at
   `AWAITING_APPROVAL`; its publishing gate cannot be bypassed by this code.
6. Before release, run sandbox end-to-end tests including wrong merchant,
   product, metadata, customer, amount, refund, duplicate and concurrent
   webhook/reconcile, missing brief, failed send and delivery readback.
   Re-check refund status at release so a later refund after paid admission
   cannot leave an obsolete entitlement in the delivery queue.

The root `node --test server/fight-pack-admission.test.mjs` exercises the pure
domain seam with synthetic fixtures. It is not Stripe, database, email,
video-factory or customer acceptance proof.
