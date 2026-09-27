import test from 'node:test';
import assert from 'node:assert/strict';
import { createFightPackBriefIntake } from './fight-pack-brief-intake.mjs';

const ORDER = 'VF-2026-003';
const CORRELATION = 'e7523fe4-a7e6-4705-b8c1-ef2fe1e03094';

function fixture({ admitted = true, bindingMissing = false, transport = null, now = Date.parse('2026-09-24T09:00:00Z') } = {}) {
  let clock = now;
  const rows = new Map();
  const stops = [];
  const admissionStore = {
    async getAdmitted(ref) { return admitted && ref === ORDER ? { orderRef: ORDER, receiptRef: 'receipt-fixture' } : null; },
    async getBinding(ref) { return !bindingMissing && ref === ORDER ? {
      orderRef: ORDER, correlationId: CORRELATION, product: 'josh_full_fight_pack_v1',
      customerEmail: 'buyer@example.test',
    } : null; },
  };
  // The production store must implement these as atomic conditional database changes.
  const store = {
    async enqueue(row) {
      const inserted = !rows.has(row.orderRef);
      if (inserted) rows.set(row.orderRef, structuredClone(row));
      return { row: structuredClone(rows.get(row.orderRef)), inserted };
    },
    async getRequest(ref) { return structuredClone(rows.get(ref) ?? null); },
    async claim(ref, patch) {
      const row = rows.get(ref);
      if (row?.status !== 'HELD_TRANSPORT') return null;
      Object.assign(row, patch, { status: 'DISPATCHING' });
      return structuredClone(row);
    },
    async markDispatched(ref) {
      const row = rows.get(ref);
      if (row.status !== 'DISPATCHING') throw Error('bad test transition');
      row.status = 'AWAITING_BRIEF'; return structuredClone(row);
    },
    async holdUncertain(ref) {
      const row = rows.get(ref); row.status = 'DELIVERY_UNCERTAIN'; return structuredClone(row);
    },
    async consume(tokenHash, brief, briefHash, at) {
      const row = [...rows.values()].find(value => value.tokenHash === tokenHash);
      if (!row || row.status !== 'AWAITING_BRIEF' || row.expiresAt <= at) return null;
      Object.assign(row, { status: 'BRIEF_RECEIVED', tokenHash: null, brief, briefHash, receivedAt: at });
      return structuredClone(row);
    },
    async getActiveToken(tokenHash, at) {
      const row = [...rows.values()].find(value => value.tokenHash === tokenHash);
      return row?.status === 'AWAITING_BRIEF' && row.expiresAt > at ? structuredClone(row) : null;
    },
  };
  const service = createFightPackBriefIntake({
    admissionStore, store, transport, publicOrigin: 'https://vipfish.example', now: () => new Date(clock),
    stops: { async record(stop) { stops.push(stop); } },
  });
  return { service, store, rows, stops, advance(ms) { clock += ms; } };
}

test('only a durable paid admission can queue Josh’s brief request', async () => {
  const f = fixture({ admitted: false });
  await assert.rejects(f.service.queue({ orderRef: ORDER }), error => error.code === 'PAYMENT_NOT_ADMITTED');
  assert.equal(f.rows.size, 0);
  assert.equal(f.stops[0].stage, 'INTAKE_REQUEST');
  assert.equal(f.stops[0].correlationId, CORRELATION);
  assert.equal(JSON.stringify(f.stops).includes('buyer@example.test'), false);
});

test('duplicate queue attempts leave one held request and no customer send', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.service.queue({ orderRef: ORDER }), f.service.queue({ orderRef: ORDER })]);
  assert.equal(a.status, 'HELD_TRANSPORT');
  assert.equal(b.status, 'HELD_TRANSPORT');
  assert.equal(f.rows.size, 1);
  assert.equal(f.rows.get(ORDER).tokenHash, null);
  assert.equal(f.stops.filter(stop => stop.code === 'BRIEF_TRANSPORT_HELD').length, 1);
});

test('a trusted dispatcher issues one expiring request after admission and does not resend', async () => {
  const sent = [];
  const f = fixture({ transport: { async sendBriefRequest(message) { sent.push(message); } } });
  await f.service.queue({ orderRef: ORDER });
  const [a, b] = await Promise.all([f.service.dispatch({ orderRef: ORDER }), f.service.dispatch({ orderRef: ORDER })]);
  assert.deepEqual([a.status, b.status].sort(), ['ALREADY_REQUESTED', 'AWAITING_BRIEF']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'buyer@example.test');
  assert.equal(sent[0].idempotencyKey, `brief:${ORDER}`);
  const url = new URL(sent[0].url);
  assert.equal(url.origin, 'https://vipfish.example');
  assert.equal(url.pathname, '/fight-pack-brief.html');
  assert.match(url.hash, /^#token=[A-Za-z0-9_-]{43}$/);
  assert.equal(f.rows.get(ORDER).tokenHash.length, 64);
  assert.equal(JSON.stringify(f.stops).includes('buyer@example.test'), false);
});

test('a confirmed brief consumes its token and cannot be changed by replay', async () => {
  let link;
  const f = fixture({ transport: { async sendBriefRequest({ url }) { link = url; } } });
  await f.service.queue({ orderRef: ORDER });
  await f.service.dispatch({ orderRef: ORDER });
  const token = new URL(link).hash.slice('#token='.length);
  const accepted = await f.service.submit({ token, brief: 'Please revise the fight pack using the supplied facts.', factsConfirmed: true });
  assert.equal(accepted.status, 'BRIEF_RECEIVED');
  assert.equal(f.rows.get(ORDER).brief.text, 'Please revise the fight pack using the supplied facts.');
  assert.equal(f.rows.get(ORDER).briefHash.length, 64);
  await assert.rejects(f.service.submit({ token, brief: 'Change the scope', factsConfirmed: true }), error => error.code === 'BRIEF_LINK_INVALID');
  assert.equal(f.rows.get(ORDER).brief.text, 'Please revise the fight pack using the supplied facts.');
});

test('an empty or unconfirmed brief stays held and cannot consume the token', async () => {
  let link;
  const f = fixture({ transport: { async sendBriefRequest({ url }) { link = url; } } });
  await f.service.queue({ orderRef: ORDER });
  await f.service.dispatch({ orderRef: ORDER });
  const token = new URL(link).hash.slice('#token='.length);
  await assert.rejects(f.service.submit({ token, brief: ' ', factsConfirmed: true }), error => error.code === 'BRIEF_REQUIRED');
  await assert.rejects(f.service.submit({ token, brief: 'Some facts', factsConfirmed: false }), error => error.code === 'BRIEF_CONFIRMATION_REQUIRED');
  assert.equal(f.rows.get(ORDER).status, 'AWAITING_BRIEF');
  assert.equal(f.stops.at(-1).code, 'BRIEF_CONFIRMATION_REQUIRED');
});

test('a delivery error remains uncertain and never automatically resends', async () => {
  let calls = 0;
  const f = fixture({ transport: { async sendBriefRequest() { calls++; throw Error('private transport detail'); } } });
  await f.service.queue({ orderRef: ORDER });
  await assert.rejects(f.service.dispatch({ orderRef: ORDER }), error => error.code === 'BRIEF_DELIVERY_UNCERTAIN' && !error.message.includes('private'));
  assert.equal((await f.service.dispatch({ orderRef: ORDER })).status, 'DELIVERY_UNCERTAIN');
  assert.equal(calls, 1);
  assert.equal(f.stops.at(-1).code, 'BRIEF_DELIVERY_UNCERTAIN');
  assert.equal(JSON.stringify(f.stops).includes('buyer@example.test'), false);
});

test('an expired request never admits a brief', async () => {
  let link;
  const f = fixture({ transport: { async sendBriefRequest({ url }) { link = url; } } });
  await f.service.queue({ orderRef: ORDER });
  await f.service.dispatch({ orderRef: ORDER });
  f.advance(72 * 60 * 60 * 1000 + 1);
  const token = new URL(link).hash.slice('#token='.length);
  await assert.rejects(f.service.submit({ token, brief: 'Confirmed details', factsConfirmed: true }), error => error.code === 'BRIEF_LINK_INVALID');
  assert.equal(f.rows.get(ORDER).status, 'AWAITING_BRIEF');
  assert.equal(f.rows.get(ORDER).brief, undefined);
});

test('a request without an approved transport stays held and has no token', async () => {
  const f = fixture();
  await f.service.queue({ orderRef: ORDER });
  assert.deepEqual(await f.service.dispatch({ orderRef: ORDER }), { orderRef: ORDER, status: 'HELD_TRANSPORT' });
  assert.equal(f.rows.get(ORDER).tokenHash, null);
});

test('a missing binding remains an admission stop with a safe opaque correlation', async () => {
  const f = fixture({ bindingMissing: true });
  await assert.rejects(f.service.queue({ orderRef: ORDER }), error => error.code === 'PAYMENT_NOT_ADMITTED');
  assert.match(f.stops[0].correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(f.stops[0].code, 'PAYMENT_NOT_ADMITTED');
});

test('database failure holds the brief request and records a safe stop', async () => {
  const f = fixture();
  f.store.enqueue = async () => { throw Error('private database detail'); };
  await assert.rejects(f.service.queue({ orderRef: ORDER }), error => error.code === 'INTAKE_STORE_UNAVAILABLE' && !error.message.includes('private'));
  assert.equal(f.stops[0].code, 'INTAKE_STORE_UNAVAILABLE');
  assert.equal(JSON.stringify(f.stops).includes('private database detail'), false);
});
