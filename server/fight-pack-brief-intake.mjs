import { createHash, randomBytes, randomUUID } from 'node:crypto';

// VF-2026-003 is a bespoke full fight pack. Promotion Fix's £15 route and
// Stage-4's RECORDED_ONLY receipt are not admission for this product.
const ORDER = 'VF-2026-003';
const PRODUCT = 'josh_full_fight_pack_v1';
const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const STOP = {
  PAYMENT_NOT_ADMITTED: ['INTAKE_REQUEST', 'AUTHORITY', 'INTAKE_REQUEST', 'PAYMENT_INTEGRATION', 'BIND_ORDER_AND_REPLAY', 'ORDER_BOUND_TO_PAYMENT'],
  BRIEF_CONTACT_MISSING: ['INTAKE_REQUEST', 'DATA', 'INTAKE_REQUEST', 'ORDER_OPERATIONS', 'RESOLVE_CUSTOMER_CONTACT', 'CUSTOMER_CONTACT_VERIFIED'],
  BRIEF_TRANSPORT_HELD: ['INTAKE_REQUEST', 'CONFIG', 'INTAKE_REQUEST', 'ORDER_OPERATIONS', 'RETRY_INTAKE_REQUEST', 'BRIEF_REQUEST_SENT'],
  BRIEF_DELIVERY_UNCERTAIN: ['INTAKE_REQUEST', 'EXTERNAL', 'INTAKE_REQUEST', 'ORDER_OPERATIONS', 'INVESTIGATE_AND_RECONCILE', 'BRIEF_REQUEST_SENT'],
  BRIEF_REQUIRED: ['BRIEF_CONFIRMATION', 'DATA', 'PRODUCTION', 'ORDER_OPERATIONS', 'REQUEST_BRIEF', 'BRIEF_RECEIVED'],
  BRIEF_CONFIRMATION_REQUIRED: ['BRIEF_CONFIRMATION', 'AUTHORITY', 'PRODUCTION', 'ORDER_OPERATIONS', 'CONFIRM_BRIEF', 'BRIEF_CONFIRMED'],
  INTAKE_STORE_UNAVAILABLE: ['INTAKE_REQUEST', 'EXTERNAL', 'INTAKE_REQUEST', 'PRODUCTION_ENGINEERING', 'REVIEW_AND_RETRY', 'REVIEWED_RECOVERY_VERIFIED'],
  INTAKE_STORE_MISMATCH: ['INTAKE_REQUEST', 'DATA', 'INTAKE_REQUEST', 'PRODUCTION_ENGINEERING', 'INVESTIGATE_AND_RECONCILE', 'REVIEWED_RECOVERY_VERIFIED'],
};
const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fail(code, status = 409) {
  return Object.assign(new Error(code), { code, status });
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createFightPackBriefIntake({ admissionStore, store, stops, transport = null, publicOrigin, now = () => new Date() }) {
  if (!admissionStore?.getAdmitted || !admissionStore?.getBinding || !store?.enqueue ||
      !store?.getRequest || !store?.claim || !store?.markDispatched || !store?.holdUncertain ||
      !store?.getActiveToken || !store?.consume || !stops?.record) throw fail('INTAKE_NOT_CONFIGURED', 503);
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash ||
      origin.username || origin.password) throw fail('INTAKE_ORIGIN_INVALID', 503);

  async function record(code, correlationId) {
    const [stage, category, heldEffect, owner, recovery, exitCheck] = STOP[code];
    try {
      await stops.record({
        correlationId, stage, category, code, heldEffect, owner,
        recovery, exitCheck, evidenceRefs: [],
      });
    } catch { throw fail('STOP_LOG_UNAVAILABLE', 503); }
  }

  async function readStore(operation, correlationId) {
    try { return await operation(); }
    catch {
      await record('INTAKE_STORE_UNAVAILABLE', correlationId);
      throw fail('INTAKE_STORE_UNAVAILABLE', 503);
    }
  }

  async function admittedBinding(orderRef) {
    if (orderRef !== ORDER) throw fail('ORDER_NOT_ELIGIBLE', 404);
    const binding = await readStore(() => admissionStore.getBinding(orderRef), randomUUID());
    const correlationId = uuid4.test(binding?.correlationId) ? binding.correlationId : randomUUID();
    const admission = await readStore(() => admissionStore.getAdmitted(orderRef), correlationId);
    if (!admission || admission.orderRef !== orderRef || !admission.receiptRef ||
        binding?.orderRef !== orderRef || binding?.product !== PRODUCT ||
        !uuid4.test(binding?.correlationId)) {
      await record('PAYMENT_NOT_ADMITTED', correlationId);
      throw fail('PAYMENT_NOT_ADMITTED');
    }
    if (typeof binding.customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(binding.customerEmail)) {
      await record('BRIEF_CONTACT_MISSING', correlationId);
      throw fail('BRIEF_CONTACT_MISSING');
    }
    return { binding, admission };
  }

  async function queue({ orderRef } = {}) {
    const { binding, admission } = await admittedBinding(orderRef);
    // enqueue is a durable INSERT ... ON CONFLICT DO NOTHING keyed by orderRef.
    const { row, inserted } = await readStore(() => store.enqueue({
      orderRef, correlationId: binding.correlationId, receiptRef: admission.receiptRef,
      status: 'HELD_TRANSPORT', tokenHash: null, createdAt: now().toISOString(),
    }), binding.correlationId);
    if (!row || row.orderRef !== orderRef || row.receiptRef !== admission.receiptRef) {
      await record('INTAKE_STORE_MISMATCH', binding.correlationId);
      throw fail('INTAKE_STORE_MISMATCH', 503);
    }
    if (inserted) await record('BRIEF_TRANSPORT_HELD', binding.correlationId);
    return { orderRef, status: row.status };
  }

  // Trusted internal worker only. There is no public dispatch route or default
  // transport. A production transport must provide provider-level idempotency.
  async function dispatch({ orderRef } = {}) {
    const { binding, admission } = await admittedBinding(orderRef);
    const current = await readStore(() => store.getRequest(orderRef), binding.correlationId);
    if (!current || current.receiptRef !== admission.receiptRef) throw fail('REQUEST_NOT_QUEUED');
    if (current.status !== 'HELD_TRANSPORT') return {
      orderRef, status: current.status === 'AWAITING_BRIEF' || current.status === 'BRIEF_RECEIVED' || current.status === 'DISPATCHING'
        ? 'ALREADY_REQUESTED' : current.status,
    };
    if (typeof transport?.sendBriefRequest !== 'function') {
      return { orderRef, status: 'HELD_TRANSPORT' };
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now().getTime() + TOKEN_TTL_MS).toISOString();
    // claim is a conditional durable UPDATE from HELD_TRANSPORT. The token is
    // stored only as a digest and never placed in logs or a URL query string.
    const claimed = await readStore(() => store.claim(orderRef, { tokenHash: digest(token), expiresAt }), binding.correlationId);
    if (!claimed) return { orderRef, status: 'ALREADY_REQUESTED' };
    const url = `${origin.origin}/fight-pack-brief.html#token=${token}`;
    try {
      await transport.sendBriefRequest({
        to: binding.customerEmail, url, orderRef, idempotencyKey: `brief:${orderRef}`,
      });
      await readStore(() => store.markDispatched(orderRef), binding.correlationId);
    } catch {
      // A transport timeout can mean the message was sent. Never auto-resend.
      await readStore(() => store.holdUncertain(orderRef), binding.correlationId);
      await record('BRIEF_DELIVERY_UNCERTAIN', binding.correlationId);
      throw fail('BRIEF_DELIVERY_UNCERTAIN', 503);
    }
    return { orderRef, status: 'AWAITING_BRIEF' };
  }

  async function submit({ token, brief, factsConfirmed } = {}) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail('BRIEF_LINK_INVALID', 404);
    const tokenHash = digest(token);
    const at = now().toISOString();
    const request = await readStore(() => store.getActiveToken(tokenHash, at), randomUUID());
    if (!request) throw fail('BRIEF_LINK_INVALID', 404);
    const text = typeof brief === 'string' ? brief.trim() : '';
    if (!text || text.length > 10_000) {
      await record('BRIEF_REQUIRED', request.correlationId);
      throw fail('BRIEF_REQUIRED', 400);
    }
    if (factsConfirmed !== true) {
      await record('BRIEF_CONFIRMATION_REQUIRED', request.correlationId);
      throw fail('BRIEF_CONFIRMATION_REQUIRED', 400);
    }
    const confirmed = { text, factsConfirmed: true };
    const briefHash = digest(JSON.stringify(confirmed));
    // consume is a single conditional UPDATE on digest, status and expiry.
    const saved = await readStore(() => store.consume(tokenHash, confirmed, briefHash, at), request.correlationId);
    if (!saved) throw fail('BRIEF_LINK_INVALID', 404);
    return { orderRef: saved.orderRef, status: 'BRIEF_RECEIVED', briefHash };
  }

  return { queue, dispatch, submit };
}
