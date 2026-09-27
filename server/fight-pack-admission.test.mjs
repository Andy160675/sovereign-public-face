import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFightPackAdmission, FIGHT_PACK_PRODUCT, correctionDigest } from './fight-pack-admission.mjs';

const orderRef = 'VF-2026-003';
const accountId = 'acct_TEST_LTD';
const sessionId = 'cs_live_TEST_003';
const paymentIntentId = 'pi_TEST_003';
const chargeId = 'ch_TEST_003';
const paymentLinkId = 'plink_TEST_003';
const priceId = 'price_TEST_003';
const productId = 'prod_TEST_003';

function fixture(overrides = {}) {
  const binding = {
    orderRef, product: FIGHT_PACK_PRODUCT, accountId, mode: 'live',
    sessionId, paymentIntentId, chargeId, paymentLinkId, priceId, productId,
    correlationId: 'a0a0a0a0-0000-4000-8000-000000000003',
    authorityReceiptRef: 'protected:VF003-binding-001',
    amountMinor: 1500, currency: 'gbp', customerEmail: 'josh@example.invalid',
    ...overrides.binding,
  };
  const session = {
    id: sessionId, mode: 'payment', status: 'complete', payment_status: 'paid',
    amount_total: 1500, currency: 'gbp', livemode: true,
    payment_link: paymentLinkId, payment_intent: paymentIntentId,
    customer_details: { email: 'josh@example.invalid' },
    metadata: { vf: orderRef, product: FIGHT_PACK_PRODUCT },
    ...overrides.session,
  };
  const intent = {
    id: paymentIntentId, status: 'succeeded', amount: 1500, amount_received: 1500,
    currency: 'gbp', livemode: true, latest_charge: chargeId,
    ...overrides.intent,
  };
  const charge = {
    id: chargeId, payment_intent: paymentIntentId, amount: 1500,
    currency: 'gbp', paid: true, captured: true, refunded: false,
    amount_refunded: 0, livemode: true, ...overrides.charge,
  };
  const lineItems = { data: [{ id: 'li_TEST_003', quantity: 1, amount_total: 1500,
    currency: 'gbp', price: { id: priceId, product: productId } }], has_more: false,
    ...overrides.lineItems };
  const stops = [];
  const admissions = new Map();
  const store = {
    async getBinding(ref) { return ref === orderRef ? binding : null; },
    async admit(ref, evidence) {
      const previous = admissions.get(ref);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(evidence)) throw new Error('ADMISSION_CONFLICT');
        return { state: 'ALREADY_ADMITTED', receiptRef: `order:${ref}:paid` };
      }
      admissions.set(ref, evidence);
      return { state: 'PAID_BOUND', receiptRef: `order:${ref}:paid` };
    },
  };
  const stripe = {
    async retrieveAccount() { return { id: overrides.accountId ?? accountId }; },
    async retrieveSession() { return session; },
    async retrievePaymentIntent() { return intent; },
    async retrieveCharge() { return charge; },
    async retrieveSessionLineItems() { return lineItems; },
  };
  const service = createFightPackAdmission({
    store, stripe, authority: overrides.authority,
    stops: { async record(stop) { stops.push(stop); } },
    now: () => '2026-09-24T08:00:00.000Z',
  });
  return { service, binding, session, intent, charge, lineItems, admissions, stops };
}

test('exact account/session/product/paid charge admits only once and records a safe receipt reference', async () => {
  const f = fixture();
  const a = await f.service.reconcile({ orderRef });
  const b = await f.service.reconcile({ orderRef });
  assert.equal(a.state, 'PAID_BOUND');
  assert.equal(b.state, 'ALREADY_ADMITTED');
  assert.equal(f.admissions.size, 1);
  assert.equal(f.stops.length, 0);
  assert.equal(a.receiptRef, `order:${orderRef}:paid`);
  assert.equal(f.admissions.get(orderRef).paymentIntentId, paymentIntentId);
});

test('concurrent reconciliation returns one admission and one duplicate without a second entitlement', async () => {
  const f = fixture();
  const results = await Promise.all([
    f.service.reconcile({ orderRef }), f.service.reconcile({ orderRef }),
  ]);
  assert.deepEqual(results.map(r => r.state).sort(), ['ALREADY_ADMITTED', 'PAID_BOUND']);
  assert.equal(f.admissions.size, 1);
});

test('missing original binding authority receipt holds before Stripe readback', async () => {
  const f = fixture({ binding: { authorityReceiptRef: null } });
  await assert.rejects(f.service.reconcile({ orderRef }), { code: 'BINDING_INCOMPLETE' });
  assert.equal(f.admissions.size, 0);
});

for (const [name, changes, code] of [
  ['wrong merchant', { accountId: 'acct_OTHER' }, 'ACCOUNT_MISMATCH'],
  ['wrong mode', { session: { livemode: false } }, 'MODE_MISMATCH'],
  ['wrong session', { session: { id: 'cs_live_OTHER' } }, 'SESSION_MISMATCH'],
  ['wrong payment link', { session: { payment_link: 'plink_OTHER' } }, 'PAYMENT_LINK_MISMATCH'],
  ['wrong line item product', { lineItems: { data: [{ quantity: 1, amount_total: 1500, currency: 'gbp', price: { id: priceId, product: 'prod_OTHER' } }] } }, 'PRODUCT_MISMATCH'],
  ['wrong line item price', { lineItems: { data: [{ quantity: 1, amount_total: 1500, currency: 'gbp', price: { id: 'price_OTHER', product: productId } }] } }, 'PRODUCT_MISMATCH'],
  ['wrong order metadata', { session: { metadata: { vf: 'VF-2026-002', product: FIGHT_PACK_PRODUCT } } }, 'METADATA_CONFLICT'],
  ['wrong product', { session: { metadata: { vf: orderRef, product: 'promotion_fix_v1' } } }, 'PRODUCT_MISMATCH'],
  ['wrong price', { session: { amount_total: 1499 } }, 'AMOUNT_MISMATCH'],
  ['wrong currency', { session: { currency: 'usd' } }, 'CURRENCY_MISMATCH'],
  ['other customer', { session: { customer_details: { email: 'other@example.invalid' } } }, 'CUSTOMER_MISMATCH'],
  ['unpaid session', { session: { payment_status: 'unpaid' } }, 'PAYMENT_NOT_CONFIRMED'],
  ['other payment intent', { session: { payment_intent: 'pi_OTHER' } }, 'PAYMENT_INTENT_MISMATCH'],
  ['unpaid intent', { intent: { status: 'requires_payment_method' } }, 'PAYMENT_NOT_CONFIRMED'],
  ['other charge', { intent: { latest_charge: 'ch_OTHER' } }, 'CHARGE_MISMATCH'],
  ['partial refund', { charge: { amount_refunded: 100 } }, 'REFUND_PRESENT'],
  ['full refund', { charge: { refunded: true, amount_refunded: 1500 } }, 'REFUND_PRESENT'],
]) {
  test(`${name} holds and never admits (${code})`, async () => {
    const f = fixture(changes);
    await assert.rejects(f.service.reconcile({ orderRef }), { code });
    assert.equal(f.admissions.size, 0);
    assert.equal(f.stops.length, 1);
    assert.equal(f.stops[0].code, code);
    const publicStop = JSON.stringify(f.stops[0]);
    for (const secret of [sessionId, paymentIntentId, chargeId, 'josh@example.invalid']) {
      assert.equal(publicStop.includes(secret), false);
    }
  });
}

test('the already paid VF-2026-003 with stale VF-2026-002 metadata stays on hold', async () => {
  const f = fixture({ session: { metadata: { vf: 'VF-2026-002' } } });
  await assert.rejects(f.service.reconcile({ orderRef }), { code: 'METADATA_CONFLICT' });
  assert.deepEqual([...f.admissions.keys()], []);
});

test('an independent named correction receipt can reconcile exact historical objects without rewriting Stripe metadata', async () => {
  let checked = 0;
  const f = fixture({
    session: { metadata: { vf: 'VF-2026-002' } },
    authority: { async verifyCorrection({ correction, digest }) {
      checked++;
      assert.equal(correction.authorisedBy, 'Andrew Jones');
      assert.equal(correction.bindingDigest, digest);
      return { valid: true, receiptRef: 'protected:VF003-correction-001',
        authorisedBy: 'Andrew Jones', bindingDigest: digest };
    } },
  });
  f.binding.correction = {
    observedOrderRef: 'VF-2026-002', correctedOrderRef: orderRef,
    authorisedBy: 'Andrew Jones', receiptRef: 'protected:VF003-correction-001',
    bindingDigest: correctionDigest(f.binding, f.session, f.intent, f.charge, f.lineItems),
  };
  const result = await f.service.reconcile({ orderRef });
  assert.equal(result.state, 'PAID_BOUND');
  assert.equal(checked, 1);
  assert.equal(f.admissions.get(orderRef).correctionReceiptRef, 'protected:VF003-correction-001');
  assert.equal(f.session.metadata.vf, 'VF-2026-002');
});

test('a correction receipt bound to another charge refuses even if authority says valid', async () => {
  const f = fixture({
    session: { metadata: { vf: 'VF-2026-002' } },
    authority: { async verifyCorrection() { return { valid: true, receiptRef: 'protected:wrong', authorisedBy: 'Andrew Jones' }; } },
  });
  f.binding.correction = {
    observedOrderRef: 'VF-2026-002', correctedOrderRef: orderRef,
    authorisedBy: 'Andrew Jones', receiptRef: 'protected:wrong', bindingDigest: '0'.repeat(64),
  };
  await assert.rejects(f.service.reconcile({ orderRef }), { code: 'METADATA_CONFLICT' });
  assert.equal(f.admissions.size, 0);
});

test('a stop logger failure is hard hold, not a route to admission', async () => {
  const f = fixture({ session: { amount_total: 1499 } });
  const service = createFightPackAdmission({
    store: { getBinding: async () => f.binding, admit: async () => { throw new Error('must not admit'); } },
    stripe: {
      retrieveAccount: async () => ({ id: accountId }),
      retrieveSession: async () => f.session,
      retrievePaymentIntent: async () => f.intent,
      retrieveCharge: async () => f.charge,
      retrieveSessionLineItems: async () => f.lineItems,
    },
    stops: { record: async () => { throw new Error('logger offline'); } },
  });
  await assert.rejects(service.reconcile({ orderRef }), { code: 'STOP_LOG_UNAVAILABLE' });
});

test('provider outage cannot be interpreted as payment', async () => {
  const f = fixture();
  const service = createFightPackAdmission({
    store: { getBinding: async () => f.binding, admit: async () => { throw new Error('must not admit'); } },
    stripe: {
      retrieveAccount: async () => { throw new Error('provider down'); },
      retrieveSession: async () => f.session,
      retrievePaymentIntent: async () => f.intent,
      retrieveCharge: async () => f.charge,
      retrieveSessionLineItems: async () => f.lineItems,
    },
    stops: { record: async (entry) => f.stops.push(entry) },
  });
  await assert.rejects(service.reconcile({ orderRef }), { code: 'PROVIDER_UNAVAILABLE' });
  assert.equal(f.stops[0].code, 'PROVIDER_UNAVAILABLE');
});
