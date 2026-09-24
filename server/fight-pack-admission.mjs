/**
 * Josh's customer-specific full fight pack payment admission.
 *
 * This is a domain boundary, not a live endpoint. A production caller must
 * supply a durable immutable binding store, an account-scoped Stripe reader,
 * and a durable operational stop logger. Nothing here charges, sends, or
 * creates a Checkout Session. The public Promotion Fix service is unrelated.
 *
 * A new webhook can wake this reconciler, but cannot make a session paid by
 * itself. The reconciler reads the exact pre-bound Session, PaymentIntent and
 * Charge with credentials for the expected merchant before admission.
 */
import { createHash, randomUUID } from 'node:crypto';

export const FIGHT_PACK_PRODUCT = 'josh_full_fight_pack_v1';

export class AdmissionHold extends Error {
  constructor(code) {
    super(code);
    this.name = 'AdmissionHold';
    this.code = code;
  }
}

function sameEmail(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sameMode(object, mode) {
  return typeof object?.livemode === 'boolean' && object.livemode === (mode === 'live');
}

/** Digest of exact provider identity; no old-order metadata is overwritten. */
export function correctionDigest(binding, session, intent, charge, lineItems) {
  const item = lineItems?.data?.[0];
  const fields = [
    binding.orderRef, binding.product, binding.accountId, binding.mode,
    binding.sessionId, binding.paymentIntentId, binding.chargeId,
    binding.paymentLinkId, binding.priceId, binding.productId,
    binding.amountMinor, binding.currency, binding.customerEmail?.trim().toLowerCase(),
    binding.authorityReceiptRef,
    session.id, session.metadata?.vf ?? null, session.payment_intent,
    intent.id, intent.latest_charge, charge.id, charge.payment_intent,
    item?.price?.id, item?.price?.product, item?.amount_total,
  ];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

/**
 * store.getBinding(orderRef) must read a protected, immutable row with exact
 * provider IDs. store.admit(orderRef, evidence) must atomically insert one
 * admission under UNIQUE(account, mode, Session), UNIQUE(account, mode, PI),
 * and UNIQUE(orderRef). The same evidence returns ALREADY_ADMITTED; any
 * different evidence refuses. No in-memory fallback is allowed in production.
 */
export function createFightPackAdmission({ store, stripe, stops, authority }) {
  if (typeof store?.getBinding !== 'function' || typeof store?.admit !== 'function' ||
      typeof stripe?.retrieveAccount !== 'function' || typeof stripe?.retrieveSession !== 'function' ||
      typeof stripe?.retrievePaymentIntent !== 'function' || typeof stripe?.retrieveCharge !== 'function' ||
      typeof stripe?.retrieveSessionLineItems !== 'function' ||
      typeof stops?.record !== 'function') {
    throw new TypeError('ADMISSION_DEPENDENCY_MISSING');
  }

  async function hold(context, code, category = 'RECONCILIATION') {
    const stage = ['BINDING_NOT_FOUND', 'BINDING_INCOMPLETE', 'METADATA_CONFLICT',
      'PRODUCT_MISMATCH', 'PAYMENT_LINK_MISMATCH', 'ACCOUNT_MISMATCH'].includes(code)
      ? 'PAYMENT_BINDING' : 'PAID_ADMISSION';
    try {
      await stops.record({
        correlationId: context.correlationId,
        stage,
        category,
        code,
        heldEffect: 'PAID_ADMISSION',
        owner: 'PAYMENT_INTEGRATION',
        recovery: code === 'METADATA_CONFLICT' ? 'RESOLVE_IMMUTABLE_ORDER_BINDING' : 'INVESTIGATE_AND_RECONCILE',
        exitCheck: 'EXACT_ACCOUNT_SESSION_PAYMENT_AND_ORDER_MATCH',
        evidenceRefs: [],
      });
    } catch {
      throw new AdmissionHold('STOP_LOG_UNAVAILABLE');
    }
    throw new AdmissionHold(code);
  }

  async function read(context, operation) {
    try { return await operation(); }
    catch { return hold(context, 'PROVIDER_UNAVAILABLE', 'EXTERNAL'); }
  }

  async function reconcile({ orderRef } = {}) {
    if (typeof orderRef !== 'string' || !/^VF-[0-9]{4}-[0-9]{3,}$/.test(orderRef)) {
      throw new AdmissionHold('ORDER_REF_INVALID');
    }
    const context = { correlationId: randomUUID() };
    let binding;
    try { binding = await store.getBinding(orderRef); }
    catch { return hold(context, 'BINDING_STORE_UNAVAILABLE', 'EXECUTION'); }
    if (!binding) return hold(context, 'BINDING_NOT_FOUND', 'CONFIG');
    if (typeof binding.correlationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(binding.correlationId)) {
      return hold(context, 'BINDING_INCOMPLETE', 'CONFIG');
    }
    context.correlationId = binding.correlationId;

    // This is a single, customer-specific offer. A copied £15 Promotion Fix
    // row or a guessed match by amount must never qualify.
    if (binding.orderRef !== orderRef || binding.product !== FIGHT_PACK_PRODUCT ||
        binding.mode !== 'live' || binding.amountMinor !== 1500 ||
        binding.currency !== 'gbp' || !binding.accountId || !binding.sessionId ||
        !binding.paymentIntentId || !binding.chargeId || !binding.paymentLinkId ||
        !binding.priceId || !binding.productId || !binding.customerEmail ||
        !binding.authorityReceiptRef) {
      return hold(context, 'BINDING_INCOMPLETE', 'CONFIG');
    }

    const account = await read(context, () => stripe.retrieveAccount());
    if (account?.id !== binding.accountId) return hold(context, 'ACCOUNT_MISMATCH', 'CONFIG');
    const session = await read(context, () => stripe.retrieveSession(binding.sessionId));
    if (session?.id !== binding.sessionId) return hold(context, 'SESSION_MISMATCH');
    if (!sameMode(session, binding.mode)) return hold(context, 'MODE_MISMATCH');
    if (session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid') {
      return hold(context, 'PAYMENT_NOT_CONFIRMED');
    }
    if (session.amount_total !== binding.amountMinor) return hold(context, 'AMOUNT_MISMATCH');
    if (session.currency !== binding.currency) return hold(context, 'CURRENCY_MISMATCH');
    if (session.payment_link !== binding.paymentLinkId) return hold(context, 'PAYMENT_LINK_MISMATCH', 'CONFIG');
    const lineItems = await read(context, () => stripe.retrieveSessionLineItems(binding.sessionId));
    if (!Array.isArray(lineItems?.data) || lineItems.data.length !== 1 || lineItems.has_more !== false ||
        lineItems.data[0].quantity !== 1 || lineItems.data[0].amount_total !== binding.amountMinor ||
        lineItems.data[0].currency !== binding.currency ||
        lineItems.data[0].price?.id !== binding.priceId ||
        lineItems.data[0].price?.product !== binding.productId) {
      return hold(context, 'PRODUCT_MISMATCH', 'CONFIG');
    }
    // The historical link still carries VF-2026-002. Its conflict is evidence,
    // not authority to silently re-label the paid event VF-2026-003.
    if (session.metadata?.product && session.metadata.product !== FIGHT_PACK_PRODUCT) {
      return hold(context, 'PRODUCT_MISMATCH', 'CONFIG');
    }
    if (!sameEmail(session.customer_details?.email, binding.customerEmail)) {
      return hold(context, 'CUSTOMER_MISMATCH');
    }
    if (session.payment_intent !== binding.paymentIntentId) {
      return hold(context, 'PAYMENT_INTENT_MISMATCH');
    }

    const intent = await read(context, () => stripe.retrievePaymentIntent(binding.paymentIntentId));
    if (intent?.id !== binding.paymentIntentId) {
      return hold(context, 'PAYMENT_INTENT_MISMATCH');
    }
    if (!sameMode(intent, binding.mode)) return hold(context, 'MODE_MISMATCH');
    if (intent.status !== 'succeeded' || intent.amount_received !== binding.amountMinor ||
        intent.amount !== binding.amountMinor) return hold(context, 'PAYMENT_NOT_CONFIRMED');
    if (intent.currency !== binding.currency) return hold(context, 'CURRENCY_MISMATCH');
    if (intent.latest_charge !== binding.chargeId) {
      return hold(context, 'CHARGE_MISMATCH');
    }
    const charge = await read(context, () => stripe.retrieveCharge(intent.latest_charge));
    if (charge?.id !== intent.latest_charge || charge.payment_intent !== binding.paymentIntentId) {
      return hold(context, 'CHARGE_MISMATCH');
    }
    if (!sameMode(charge, binding.mode)) return hold(context, 'MODE_MISMATCH');
    if (charge.paid !== true || charge.captured !== true || charge.amount !== binding.amountMinor) {
      return hold(context, 'PAYMENT_NOT_CONFIRMED');
    }
    if (charge.currency !== binding.currency) return hold(context, 'CURRENCY_MISMATCH');
    if (charge.refunded !== false || charge.amount_refunded !== 0) return hold(context, 'REFUND_PRESENT');

    let correctionReceiptRef = null;
    if (session.metadata?.vf !== orderRef || session.metadata?.product !== FIGHT_PACK_PRODUCT) {
      const correction = binding.correction;
      const digest = correctionDigest(binding, session, intent, charge, lineItems);
      if (!correction || correction.observedOrderRef !== session.metadata?.vf ||
          correction.correctedOrderRef !== orderRef ||
          !correction.authorisedBy || !/\S+\s+\S+/.test(correction.authorisedBy) ||
          !correction.receiptRef || correction.bindingDigest !== digest ||
          typeof authority?.verifyCorrection !== 'function') {
        return hold(context, 'METADATA_CONFLICT', 'AUTHORITY');
      }
      let proof;
      try { proof = await authority.verifyCorrection({ correction, digest }); }
      catch { return hold(context, 'CORRECTION_PROOF_UNAVAILABLE', 'AUTHORITY'); }
      if (proof?.valid !== true || proof.receiptRef !== correction.receiptRef ||
          proof.authorisedBy !== correction.authorisedBy || proof.bindingDigest !== digest) {
        return hold(context, 'METADATA_CONFLICT', 'AUTHORITY');
      }
      correctionReceiptRef = proof.receiptRef;
    }

    // Provider IDs are passed only to the protected durable store. No buyer
    // data or raw IDs are returned or emitted to the operational stop log.
    const evidence = {
      orderRef, product: FIGHT_PACK_PRODUCT, accountId: binding.accountId,
      mode: binding.mode, sessionId: binding.sessionId,
      paymentIntentId: binding.paymentIntentId, chargeId: charge.id,
      paymentLinkId: binding.paymentLinkId,
      priceId: binding.priceId, productId: binding.productId,
      amountMinor: binding.amountMinor, currency: binding.currency,
      source: 'STRIPE_API_RECONCILIATION',
      bindingAuthorityReceiptRef: binding.authorityReceiptRef,
      correctionReceiptRef,
    };
    let result;
    try { result = await store.admit(orderRef, evidence); }
    catch { return hold(context, 'ADMISSION_STORE_UNAVAILABLE', 'EXECUTION'); }
    if (!['PAID_BOUND', 'ALREADY_ADMITTED'].includes(result?.state) ||
        typeof result.receiptRef !== 'string' || !result.receiptRef.startsWith(`order:${orderRef}:`)) {
      return hold(context, 'ADMISSION_RECEIPT_INVALID', 'EXECUTION');
    }
    return { orderRef, state: result.state, receiptRef: result.receiptRef };
  }

  return { reconcile };
}
