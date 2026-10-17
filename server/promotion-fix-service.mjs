import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const PRICE_MINOR = 1500;
export const CURRENCY = 'gbp';
export const PRODUCT = 'promotion_fix_v1';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
export function fault(status, code, message) { return Object.assign(new Error(message), {status, code}); }
function fail(status, code, message) { throw fault(status, code, message); }
function equal(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
const words = text => text.trim().split(/\s+/u).filter(Boolean).length;
// Every number counts as a fact, including ones glued to letters ("5pm", "2nd").
// am/pm stays part of the fact so "5pm" -> "7pm" or "5am" is caught; spacing and dots are normalised.
const identifiers = text => new Set((text.match(/\d+(?:[.,:]\d+)*(?:%|\s?[ap]\.?m\.?(?![a-z]))?/giu) ?? [])
  .map(m => m.toLowerCase().replace(/\s?([ap])\.?m\.?$/u, '$1m')));
function currencyFacts(text) {
  // Bind each visible currency marker to its amount. Models must never infer a
  // missing marker, even when both worker and checker agree with the inference.
  const pattern = /(\p{Sc}|\b(?:GBP|EUR|USD))\s*(\d+(?:[.,]\d+)*)|(\d+(?:[.,]\d+)*)\s*(\p{Sc}|(?:GBP|EUR|USD)\b)/giu;
  const symbols = {GBP:'£',EUR:'€',USD:'$'};
  return [...text.matchAll(pattern)].map(match => {
    const marker=(match[1]??match[4]).toUpperCase();
    return `${symbols[marker]??marker}:${match[2]??match[3]}`;
  }).sort();
}
// A figure on its own carries no meaning; what it is ATTACHED TO does. So each
// figure is read together with the words written beside it, WITHIN ITS OWN SENTENCE:
// the run since the previous figure ("Coffee £6" -> coffee), or, where nothing was
// written before it in that sentence, the run up to the next figure instead
// ("£6 coffee" -> coffee). Where English marks the attachment outright, the noun
// introduced by "for" or "per" straight after the figure is taken as well
// ("£10 for adults" -> adults), and that phrase is not re-read as the next figure's
// run. Every word of the chosen run is an anchor of that figure.
//
// Both runs stop at the sentence the figure is written in. Without that stop a
// figure reaches into its NEIGHBOURS' sentences for anchors, and which neighbour it
// reaches depends on where the figure sits in its own sentence, so merely reordering
// two whole sentences re-anchors both figures and fabricates a trade. There are two
// such reaches and both are closed here: backwards ("Dogs welcome. 20 seats only."
// gave 20 the anchors "dogs welcome") and forwards ("Doors at 7. 20 seats only.
// Booking essential." gave 20 the anchors "booking essential"). No word list and no
// capital letters take part, so the same promotion written in any case, on one line
// or on many, in any of the usual price-list shapes, is read the same way.
// A line's leading list marker ends the stretch too. Its number counts the line,
// it does not describe the item, so it must not take the item's words as anchors:
// otherwise reordering a numbered list renumbers the lines and looks like a trade.
const LIST_NUMBER = String.raw`(?:^|\n)[ \t]*[(\[]?(?:[-*•][ \t]*)?\d+`;
const SENTENCE_END = new RegExp(
  String.raw`[.!?\n]+(?=\s|$)|\n` +
  // `1.` `1)` `(1)` `1:` -- punctuation closing a line's leading number.
  String.raw`|(?<=${LIST_NUMBER})[.):\]](?=\s)` +
  // `1 - ` -- a dash marker, but only where a WORD follows, so a numeric range
  // (`7 - 9pm`) is left alone and both of its figures keep their anchors.
  String.raw`|(?<=${LIST_NUMBER})[ \t]*[-–—][ \t]*(?=\p{L})`, 'gu');
// The stretch of text the figure at [start, ends) is written in: from the end of the
// last sentence to finish before it, to the start of the first to finish after it.
function sentenceAround(text, start, ends) {
  let from = 0, to = text.length;
  for (const edge of text.matchAll(SENTENCE_END)) {
    const stops = edge.index + edge[0].length;
    if (stops <= start) from = stops;
    else if (edge.index >= ends) { to = edge.index; break; }
  }
  return [from, to];
}
const ANCHOR_WORD = /\p{L}[\p{L}\p{M}'’-]*/u;
function anchoredFigures(text) {
  const symbols = {GBP:'£',EUR:'€',USD:'$'};
  const pattern = /(\p{Sc}|\b(?:GBP|EUR|USD)\b)?\s*(\d+(?:[.,:]\d+)*(?:%|\s?[ap]\.?m\.?(?![a-z]))?)\s*(\p{Sc}|\b(?:GBP|EUR|USD)\b)?/giu;
  const spoken = slice => slice.toLowerCase().match(new RegExp(ANCHOR_WORD, 'gu')) ?? [];
  const found = [...text.matchAll(pattern)];
  let cursor = 0;
  return found.map((match, place) => {
    const marker = (match[1] ?? match[3] ?? '').toUpperCase();
    // The currency marker is part of the figure, so "£6" and "€6" are two figures.
    const figure = (marker ? `${symbols[marker] ?? marker}:` : '') + match[2].toLowerCase().replace(/\s?([ap])\.?m\.?$/u, '$1m');
    const ends = match.index + match[0].length;
    // Scope on the DIGITS, not on the whole match: the figure pattern pads itself
    // with surrounding spaces, and a marker boundary sitting in that padding
    // ("1 - Coffee") would otherwise fall inside the match and be passed over.
    const digits = match.index + match[0].indexOf(match[2]);
    const [edge, to] = sentenceAround(text, digits, digits + match[2].length);
    const from = Math.min(edge, match.index);
    const anchors = spoken(text.slice(Math.max(cursor, from), match.index));
    cursor = ends;
    const tied = text.slice(ends, to).match(new RegExp(`^[\\s,;:]*(?:for|per)\\s+(${ANCHOR_WORD.source})`, 'iu'));
    if (tied) { anchors.push(tied[1].toLowerCase()); cursor = ends + tied[0].length; }
    else if (!anchors.length) {
      const stop = Math.min(found[place + 1]?.index ?? text.length, to);
      anchors.push(...spoken(text.slice(ends, stop)));
      cursor = stop;
    }
    return {figure, anchors};
  });
}
// One figure per anchor. An anchor carrying two different figures in the same text
// says nothing about either, so it is dropped rather than guessed at.
function anchorFigures(text) {
  const held = new Map();
  for (const {figure, anchors} of anchoredFigures(text))
    for (const anchor of anchors) held.set(anchor, held.has(anchor) && held.get(anchor) !== figure ? null : figure);
  return held;
}
// The rule: refuse only on visible evidence that figures traded places. Take every
// anchor that survives into the draft holding a different figure, and draw an arrow
// from the figure it held to the figure it now holds. A cycle in those arrows means
// the figures went round between anchors rather than one figure being replaced: a
// pair that swapped is the two-step cycle, three items rotated is the three-step one.
// Moving an anchor's words along with its own figure (reordering items, clauses,
// lines or sentences) leaves every anchor holding what it held and draws no arrow at
// all, and rewording around a figure retires that anchor instead of pointing it at a
// new figure. Every refusal can name the phrases that traded.
function exchangedFigures(source, revised) {
  const before = anchorFigures(source), after = anchorFigures(revised);
  const arrows = new Map();
  for (const [anchor, held] of before) {
    const holds = after.get(anchor);
    if (held === null || holds == null || holds === held) continue;
    if (!arrows.has(held)) arrows.set(held, new Set());
    arrows.get(held).add(holds);
  }
  const state = new Map();
  const walk = figure => {
    if (state.get(figure) === 'walking') return true;
    if (state.get(figure) === 'settled') return false;
    state.set(figure, 'walking');
    const round = [...(arrows.get(figure) ?? [])].some(walk);
    state.set(figure, 'settled');
    return round;
  };
  return [...arrows.keys()].some(walk);
}
function strings(value, min = 1) {
  return Array.isArray(value) && value.length >= min && value.length <= 8 && value.every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 600);
}
function parseInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_INPUT', 'Supply one existing promotion.');
  if (Object.keys(value).some(k => !['action','promotion','language','factsConfirmed'].includes(k))) fail(400, 'INVALID_INPUT', 'Unsupported input field.');
  const promotion = typeof value.promotion === 'string' ? value.promotion.trim() : '';
  if (!promotion || promotion.length > 4000 || words(promotion) > 150 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(promotion)) fail(400, 'INVALID_INPUT', 'Use between 1 and 150 words of promotion text.');
  if (!['en','es'].includes(value.language) || value.factsConfirmed !== true) fail(400, 'INVALID_INPUT', 'Choose English or Spanish and confirm the supplied facts.');
  if (/\b(?:diagnos(?:is|e)|cure|guaranteed\s+(?:profit|returns)|investment\s+advice|prescription|weapons?|gambling|pornograph\w*|ignore\s+(?:all\s+)?(?:previous|system)\s+instructions)\b/i.test(promotion)) fail(422, 'OUT_OF_SCOPE', 'This service accepts low-risk business promotions only.');
  return {promotion, language:value.language, factsConfirmed:true};
}
function inspectDraft(input, worker, checker) {
  const w = worker?.data, c = checker?.data;
  if (w?.eligible !== true || c?.eligible !== true || c?.accepted !== true || typeof w.text !== 'string' || !w.text.trim() || w.text.length > 4000 || words(w.text) > 150 || !strings(w.changes) || !strings(w.human) || !strings(w.environment) || !strings(c.notes) || !strings(c.human) || !strings(c.environment)) fail(422, 'CHECK_FAILED', 'The independent check did not approve this draft. No checkout or charge was created.');
  const original = identifiers(input.promotion), revised = identifiers(w.text);
  if (original.size !== revised.size || [...original].some(n => !revised.has(n))) fail(422, 'CHECK_FAILED', 'The draft changed a numeric fact. No checkout or charge was created.');
  if (canonical(currencyFacts(input.promotion)) !== canonical(currencyFacts(w.text))) fail(422, 'CHECK_FAILED', 'The draft changed a currency fact. No checkout or charge was created.');
  if (exchangedFigures(input.promotion, w.text)) fail(422, 'CHECK_FAILED', 'The draft swapped two figures between the things they describe. No checkout or charge was created.');
  return {
    text:w.text.trim(), changes:w.changes,
    flags:{human:[...new Set([...w.human,...c.human])],environment:[...new Set([...w.environment,...c.environment])]},
    checkNotes:c.notes,
    boundary:'Draft wording only. Customer-supplied facts have not been externally verified. Review before publication; this is not legal, accessibility or environmental certification.',
  };
}

/** Domain service: provider calls and durable operations are injected, never substituted in live code. */
export function createPromotionService({store, model, stripe, env=process.env, now=()=>new Date()}) {
  function requireRehearsalKey(suppliedKey) {
    const key=env.PROMOTION_REHEARSAL_KEY;
    if (env.VERCEL_ENV !== 'preview' || typeof key !== 'string' || key.length < 32 || !equal(key,suppliedKey)) fail(404,'NOT_FOUND','Not found.');
  }
  const configuredOrigin = () => {
    let url; try { url = new URL(env.PROMOTION_PUBLIC_ORIGIN); } catch { fail(503,'CONFIGURATION_UNAVAILABLE','Service configuration is unavailable.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail(503,'CONFIGURATION_UNAVAILABLE','Service configuration is unavailable.');
    return url.origin;
  };
  async function authenticate(value) {
    if (!value || typeof value.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.orderId) || typeof value.accessToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.accessToken)) fail(404,'ORDER_NOT_FOUND','Order not found.');
    const order = await store.get(value.orderId);
    if (!order || !equal(order.token_hash, hash(value.accessToken))) fail(404,'ORDER_NOT_FOUND','Order not found.');
    if (hash(canonical(order.result)) !== order.result_hash) fail(503,'RESULT_INTEGRITY','The stored result could not be verified.');
    return order;
  }
  function delivered(order) {
    const receipt = order.payment_receipt;
    const {receiptHash, ...payload} = receipt ?? {};
    if (order.status !== 'PAID' || !receipt || !equal(receiptHash, hash(canonical(payload))) || receipt.orderId !== order.id || receipt.resultHash !== order.result_hash) fail(503,'RECEIPT_INTEGRITY','The delivery receipt could not be verified.');
    if (order.payment_kind === 'SYNTHETIC_TEST' && env.VERCEL_ENV !== 'preview') fail(404,'ORDER_NOT_FOUND','Order not found.');
    return {orderId:order.id,status:'PAID',paymentKind:order.payment_kind,result:order.result,receipt,usage:order.usage};
  }
  function receiptFor(order, kind, session) {
    const payload = {
      version:1, orderId:order.id, product:PRODUCT, amountMinor:PRICE_MINOR, currency:CURRENCY,
      paymentKind:kind, paymentConfirmed:kind === 'STRIPE' && session?.livemode === true, cashReceived:false,
      bankSettlementVerified:false,
      mode:kind === 'SYNTHETIC_TEST' ? 'SYNTHETIC_TEST' : session.livemode ? 'live' : 'test',
      sessionId:kind === 'STRIPE' ? session.id : null,
      inputHash:hash(canonical(order.input)),resultHash:order.result_hash,
      paidAt:now().toISOString(),
      label:kind === 'SYNTHETIC_TEST' ? 'SYNTHETIC_TEST — simulated unlock, no payment or revenue' : session.livemode ? 'Stripe reports payment received; bank settlement is not verified' : 'STRIPE_TEST — no real payment or revenue',
    };
    return {...payload,receiptHash:hash(canonical(payload))};
  }
  function verifySession(order, session) {
    if (!session || session.id !== order.checkout_session_id || session.amount_total !== PRICE_MINOR || session.currency !== CURRENCY || session.metadata?.order_id !== order.id || session.metadata?.product !== PRODUCT || session.client_reference_id !== order.id || typeof session.livemode !== 'boolean' || session.livemode !== (order.stripe_mode === 'live') || !['live','test'].includes(order.stripe_mode)) fail(409,'PAYMENT_MISMATCH','Payment details do not match this order. No result was unlocked.');
  }
  async function checkout(value) {
    const order = await authenticate(value);
    if (order.verification.rehearsalOnly === true) fail(409,'REHEARSAL_ONLY','Synthetic rehearsal orders cannot open payment checkout.');
    if (order.status === 'PAID') fail(409,'ALREADY_PAID','This order is already unlocked. Retrieve its result.');
    const production = env.VERCEL_ENV === 'production' || (env.VERCEL_ENV !== 'preview' && env.NODE_ENV === 'production');
    if (production && env.PROMOTION_CHECKOUT_STATE !== 'ENABLED') {
      fail(503,'CHECKOUT_ON_HOLD','Checkout is temporarily unavailable. Your prepared result is saved; no charge was created.');
    }
    if (order.checkout_session_id) {
      const existing = await stripe.retrieve(order.checkout_session_id);
      verifySession(order, existing);
      if (existing.payment_status === 'paid') return result(value);
      if (existing.status !== 'open' || typeof existing.url !== 'string') fail(409,'CHECKOUT_EXPIRED','Checkout expired without payment. Prepare a fresh order.');
      return {orderId:order.id,status:'READY_UNPAID',checkoutUrl:existing.url};
    }
    const origin = configuredOrigin();
    const token = encodeURIComponent(value.accessToken);
    const urls = {
      success:`${origin}/promotion-fix.html?order=${order.id}&session_id={CHECKOUT_SESSION_ID}#access_token=${token}`,
      cancel:`${origin}/promotion-fix.html?order=${order.id}#access_token=${token}`,
    };
    const session = await stripe.createCheckout(order, urls);
    if (!session || typeof session.id !== 'string' || !session.id.startsWith('cs_') || typeof session.url !== 'string' || new URL(session.url).hostname !== 'checkout.stripe.com' || new URL(session.url).protocol !== 'https:' || !['test','live'].includes(stripe.mode)) fail(502,'CHECKOUT_UNAVAILABLE','Payment checkout is unavailable; no charge was created.');
    const stored = await store.setCheckout(order.id, session.id, stripe.mode);
    if (!stored || stored.checkout_session_id !== session.id) fail(503,'CHECKOUT_UNAVAILABLE','Payment checkout could not be saved.');
    return {orderId:order.id,status:'READY_UNPAID',checkoutUrl:session.url};
  }
  async function prepare(value, context={}) {
    const input = parseInput(value);
    const rehearsalOnly = typeof context.rehearsalKey === 'string';
    if (rehearsalOnly) requireRehearsalKey(context.rehearsalKey);
    configuredOrigin();
    if (!env.PROMOTION_RATE_LIMIT_SALT || env.PROMOTION_RATE_LIMIT_SALT.length < 32 || !context.ip) fail(503,'CONFIGURATION_UNAVAILABLE','Service configuration is unavailable.');
    const keyHash = createHmac('sha256',env.PROMOTION_RATE_LIMIT_SALT).update(`promotion-ip:${context.ip}`).digest('hex');
    const windowStart = new Date(Math.floor(now().getTime()/3600000)*3600000).toISOString();
    if (!await store.consumeRate(keyHash,windowStart)) fail(429,'RATE_LIMITED','Preparation limit reached. Please try again next hour.');
    const worker = await model.generate(input);
    // A worker refusal must not spend a checker call or create checkout.
    if (worker?.data?.eligible !== true) fail(422,'OUT_OF_SCOPE','This promotion is outside the service scope. No checkout or charge was created.');
    const checker = await model.check(input,worker.data);
    const output = inspectDraft(input,worker,checker);
    const token = randomBytes(32).toString('base64url');
    const order = {
      id:randomUUID(),token_hash:hash(token),status:'READY_UNPAID',input,result:output,result_hash:hash(canonical(output)),
      verification:{independentCheck:true,checkedAt:now().toISOString(),notes:checker.data.notes,rehearsalOnly},
      usage:{worker:worker.usage,checker:checker.usage,billingScope:'Two bounded model calls, each capped at 1200 output tokens; fixed £15 customer price.',monetaryCost:{status:'NOT_RECONCILED',amount:null,currency:null}},
      created_at:now().toISOString(),checkout_session_id:null,stripe_mode:null,payment_kind:null,payment_receipt:null,paid_at:null,
    };
    await store.create(order);
    // Return the recovery token immediately after persistence. Checkout is a
    // separate request, so a slow payment provider cannot strand a ready result.
    return {orderId:order.id,accessToken:token,status:'READY_UNPAID',checkoutUrl:null,price:{amountMinor:PRICE_MINOR,currency:CURRENCY},message:'Your checked draft is saved. Payment unlocks it.'};
  }
  async function result(value) {
    let order = await authenticate(value);
    if (value.sessionId && value.sessionId !== order.checkout_session_id) fail(400,'SESSION_MISMATCH','The return session does not match this order.');
    // A previously verified receipt is durable payment evidence. Redelivery
    // must not require Stripe to be available again.
    if (order.status === 'PAID') return delivered(order);
    if (!order.checkout_session_id) return {orderId:order.id,status:'READY_UNPAID'};
    const session = await stripe.retrieve(order.checkout_session_id);
    verifySession(order,session);
    if (session.payment_status !== 'paid' || session.status !== 'complete') return {orderId:order.id,status:'READY_UNPAID'};
    order = await store.markPaid(order.id,'STRIPE',receiptFor(order,'STRIPE',session));
    if (order.payment_kind !== 'STRIPE') fail(409,'PAYMENT_MISMATCH','This order has a different payment evidence type.');
    return delivered(order);
  }
  async function reconcileSession({orderId,sessionId}={}) {
    if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId) ||
        typeof sessionId !== 'string' || !/^cs_(?:test|live)_[A-Za-z0-9_-]{1,240}$/.test(sessionId)) {
      fail(400,'INVALID_SESSION','Invalid checkout session.');
    }
    let order=await store.get(orderId);
    if (!order) fail(404,'ORDER_NOT_FOUND','Order not found.');
    if (order.verification?.rehearsalOnly || order.checkout_session_id !== sessionId ||
        hash(canonical(order.result)) !== order.result_hash) {
      fail(409,'PAYMENT_MISMATCH','Payment details do not match this order.');
    }
    if (order.status !== 'PAID') {
      const session=await stripe.retrieve(sessionId);
      verifySession(order,session);
      if (session.payment_status !== 'paid' || session.status !== 'complete') {
        fail(409,'PAYMENT_PENDING','Payment is not confirmed.');
      }
      order=await store.markPaid(order.id,'STRIPE',receiptFor(order,'STRIPE',session));
    }
    if (order?.payment_kind !== 'STRIPE') fail(409,'PAYMENT_MISMATCH','Payment evidence does not match this order.');
    const verified=delivered(order);
    return {orderId:order.id,status:'PAID',paymentKind:'STRIPE',receiptHash:verified.receipt.receiptHash};
  }
  async function simulate(value, suppliedKey) {
    requireRehearsalKey(suppliedKey);
    const order = await authenticate(value);
    if (order.verification.rehearsalOnly !== true) fail(409,'REHEARSAL_ONLY','Only an explicitly prepared synthetic rehearsal order can be simulated.');
    if (order.payment_kind === 'STRIPE') fail(409,'ALREADY_PAID','A real payment record cannot be replaced by a simulation.');
    // Prevent a live checkout from later charging for a synthetic unlock.
    if (order.checkout_session_id && order.stripe_mode === 'live') fail(409,'LIVE_CHECKOUT_EXISTS','Rehearsal requires an order without a live checkout.');
    const stored = await store.markPaid(order.id,'SYNTHETIC_TEST',receiptFor(order,'SYNTHETIC_TEST'));
    if (stored.payment_kind !== 'SYNTHETIC_TEST') fail(409,'PAYMENT_MISMATCH','Payment evidence changed.');
    return delivered(stored);
  }
  return {prepare,checkout,result,reconcileSession,simulate};
}
