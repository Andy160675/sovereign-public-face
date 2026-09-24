import test from 'node:test';
import assert from 'node:assert/strict';
import { createFightPackBriefStore } from './fight-pack-brief-store.mjs';

test('enqueue binds the order reference as a parameter and preserves the first request', async () => {
  const statements = [];
  const row = { order_ref: 'VF-2026-003', receipt_ref: 'first', status: 'HELD_TRANSPORT', token_hash: null };
  const sql = async (query, params) => {
    statements.push({ query, params });
    return query.startsWith('INSERT') ? [] : [row];
  };
  const store = createFightPackBriefStore({ sql });
  const result = await store.enqueue({ orderRef: 'VF-2026-003', receiptRef: 'replacement', correlationId: 'e7523fe4-a7e6-4705-b8c1-ef2fe1e03094', status: 'HELD_TRANSPORT', tokenHash: null, createdAt: '2026-09-24T09:00:00.000Z' });
  assert.equal(result.inserted, false);
  assert.equal(result.row.receiptRef, 'first');
  assert.match(statements[0].query, /ON CONFLICT \(order_ref\) DO NOTHING/);
  assert.ok(!statements[0].query.includes('VF-2026-003'));
  assert.equal(statements[0].params[0], 'VF-2026-003');
});

test('claim and consume use conditional database transitions, including token expiry', async () => {
  const statements = [];
  const sql = async (query, params) => { statements.push({ query, params }); return []; };
  const store = createFightPackBriefStore({ sql });
  await store.claim('VF-2026-003', { tokenHash: 'a'.repeat(64), expiresAt: '2026-09-27T09:00:00.000Z' });
  await store.consume('b'.repeat(64), { text: 'Confirmed', factsConfirmed: true }, 'c'.repeat(64), '2026-09-24T09:00:00.000Z');
  assert.match(statements[0].query, /status = 'HELD_TRANSPORT'/);
  assert.match(statements[0].query, /RETURNING/);
  assert.match(statements[1].query, /status = 'AWAITING_BRIEF'/);
  assert.match(statements[1].query, /expires_at > /);
  assert.match(statements[1].query, /token_hash = NULL/);
  assert.match(statements[1].query, /RETURNING/);
  assert.ok(statements.every(({ query }) => !query.includes('VF-2026-003')));
  assert.equal(statements[1].params[0], 'b'.repeat(64));
});
