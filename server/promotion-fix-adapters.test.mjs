import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeonStore, createAnthropicModel, createStripeClient } from './promotion-fix-adapters.mjs';

const databaseUrl = 'postgresql://test:fixture-password@ep-fixture.neon.tech/neondb?sslmode=require';
const modelName = 'claude-haiku-4-5-20251001';
const source = { promotion: 'Lunch £15 this Friday.', language: 'en', factsConfirmed: true };
const draft = { eligible: true, text: 'Enjoy lunch for £15 this Friday.', changes: ['Clarified the offer.'], human: ['Review before publication.'], environment: ['No environmental claim added.'] };
const checked = { accepted: true, eligible: true, notes: ['Price and date retained.'], human: ['Customer review required.'], environment: ['No claim added.'] };
const order = { id: '08e5206b-06bf-4b83-bf83-95c87c06854f', token_hash: 'a'.repeat(64), status: 'READY_UNPAID', input: source, result: draft, result_hash: 'b'.repeat(64), verification: checked, usage: { inputTokens: 15, outputTokens: 20 } };

function transport(...responses) {
  const requests = [];
  return {
    requests,
    fetch: async (url, init = {}) => {
      requests.push({ url: String(url), ...init });
      assert.ok(responses.length, 'Unexpected external request');
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response.body ?? response), { status: response.status ?? 200, headers: { 'content-type': 'application/json' } });
    },
  };
}
const headers = request => new Headers(request.headers);
const body = request => JSON.parse(request.body);
const modelResponse = (name, data) => ({ id: 'msg_fixture', type: 'message', role: 'assistant', model: modelName, content: [{ type: 'tool_use', id: 'tool_fixture', name, input: data }], stop_reason: 'tool_use', usage: { input_tokens: 31, output_tokens: 47 } });
function safeError(status, secret = 'UPSTREAM_SECRET_MARKER') {
  return error => {
    assert.equal(error.status, status);
    assert.equal(typeof error.code, 'string');
    assert.ok(error.code.length);
    assert.doesNotMatch(`${error.message} ${JSON.stringify(error)}`, new RegExp(secret));
    return true;
  };
}

test('Neon parameterizes order input and decodes array rows using returned fields', async () => {
  const hostile = "x'); DROP TABLE promotion_fix_orders; --";
  const row = { ...order, input: { ...source, promotion: hostile } };
  const sql = transport({ fields: Object.keys(row).map(name => ({ name })), rows: [Object.values(row).map(value => typeof value === 'object' ? JSON.stringify(value) : value)] });
  const store = createNeonStore({ PROMOTION_DATABASE_URL: databaseUrl }, sql.fetch);
  assert.deepEqual(await store.create(row), row);
  const request = sql.requests[0], payload = body(request);
  assert.equal(request.url, 'https://ep-fixture.neon.tech/sql');
  assert.equal(request.method, 'POST');
  assert.equal(headers(request).get('Neon-Connection-String'), databaseUrl);
  assert.match(payload.query, /INSERT\s+INTO\s+promotion_fix_orders/i);
  assert.match(payload.query, /\$1/);
  assert.doesNotMatch(payload.query, /DROP TABLE/);
  assert.ok(JSON.stringify(payload.params).includes('DROP TABLE'));
});

test('Neon reads object rows and parameterizes lookup identifiers', async () => {
  const id = "' OR true; --";
  const sql = transport({ rows: [{ ...order, input: JSON.stringify(source), result: JSON.stringify(draft) }] }, { rows: [] });
  const store = createNeonStore({ PROMOTION_DATABASE_URL: databaseUrl }, sql.fetch);
  const found = await store.get(id);
  assert.deepEqual(found.input, source);
  assert.deepEqual(found.result, draft);
  assert.equal(found.token_hash, order.token_hash);
  const payload = body(sql.requests[0]);
  assert.ok(payload.params.includes(id));
  assert.ok(!payload.query.includes(id));
  assert.ok((await store.get('missing')) == null);
});

test('Neon checkout and payment changes retain their parameterized durable fields', async () => {
  const receipt = { paidAt: '2026-09-23T00:00:00.000Z', cashReceived: true };
  const sql = transport({ rows: [{ ...order, checkout_session_id: 'cs_test_fixture', stripe_mode: 'test' }] }, { rows: [{ ...order, status: 'PAID', payment_kind: 'STRIPE', payment_receipt: JSON.stringify(receipt) }] });
  const store = createNeonStore({ PROMOTION_DATABASE_URL: databaseUrl }, sql.fetch);
  const checkout = await store.setCheckout(order.id, 'cs_test_fixture', 'test');
  assert.equal(checkout.checkout_session_id, 'cs_test_fixture');
  const paid = await store.markPaid(order.id, 'STRIPE', receipt);
  assert.deepEqual(paid.payment_receipt, receipt);
  for (const request of sql.requests) {
    const payload = body(request);
    assert.match(payload.query, /UPDATE\s+promotion_fix_orders/i);
    assert.ok(payload.params.includes(order.id));
    assert.ok(!payload.query.includes(order.id));
  }
  assert.ok(body(sql.requests[0]).params.includes('cs_test_fixture'));
  assert.ok(body(sql.requests[1]).params.includes('STRIPE'));
});

test('Neon consumes the ten-attempt allowance atomically and reports exhaustion', async () => {
  const sql = transport({ rows: [{ attempts: 10 }] }, { rows: [] });
  const store = createNeonStore({ PROMOTION_DATABASE_URL: databaseUrl }, sql.fetch);
  assert.equal(await store.consumeRate('c'.repeat(64), new Date('2026-09-23T00:00:00Z')), true);
  assert.equal(await store.consumeRate('c'.repeat(64), new Date('2026-09-23T00:00:00Z')), false);
  assert.equal(sql.requests.length, 2, 'One atomic database request per attempt');
  const payload = body(sql.requests[0]);
  assert.match(payload.query, /ON\s+CONFLICT/i);
  assert.match(payload.query, /attempts\s*<\s*(?:10|\$\d+)/i);
  assert.ok(payload.params.includes('c'.repeat(64)));
});

test('Anthropic forces distinct generation and verification tools with source and draft', async () => {
  const api = transport(modelResponse('submit_promotion', draft), modelResponse('verify_promotion', checked));
  const model = createAnthropicModel({ ANTHROPIC_API_KEY: 'sk-ant-fixture' }, api.fetch);
  const generated = await model.generate(source);
  const verified = await model.check(source, draft);
  assert.deepEqual(generated.data, draft);
  assert.deepEqual(verified.data, checked);
  assert.deepEqual(generated.usage, { provider: 'anthropic', model: modelName, inputTokens: 31, outputTokens: 47 });
  for (const [index, name] of ['submit_promotion', 'verify_promotion'].entries()) {
    const request = api.requests[index], payload = body(request);
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(headers(request).get('x-api-key'), 'sk-ant-fixture');
    assert.equal(payload.model, modelName);
    assert.equal(payload.max_tokens, 1200);
    assert.equal(payload.tool_choice.type, 'tool');
    assert.equal(payload.tool_choice.name, name);
    assert.ok(payload.tools.some(tool => tool.name === name && tool.input_schema));
    assert.ok(JSON.stringify(payload.messages).includes(source.promotion));
  }
  assert.ok(JSON.stringify(body(api.requests[1]).messages).includes(draft.text));
});

test('Anthropic uses an explicit configured model override', async () => {
  const api = transport({ ...modelResponse('submit_promotion', draft), model: 'configured-model' });
  const model = createAnthropicModel({ ANTHROPIC_API_KEY: 'sk-ant-fixture', ANTHROPIC_MODEL: 'configured-model' }, api.fetch);
  const result = await model.generate(source);
  assert.equal(body(api.requests[0]).model, 'configured-model');
  assert.equal(result.usage.model, 'configured-model');
});

for (const [name, response] of [
  ['text without a tool result', { content: [{ type: 'text', text: 'UPSTREAM_SECRET_MARKER' }] }],
  ['an unexpected tool name', modelResponse('wrong_tool', draft)],
]) {
  test(`Anthropic rejects ${name}`, async () => {
    const api = transport(response);
    await assert.rejects(async () => createAnthropicModel({ ANTHROPIC_API_KEY: 'sk-ant-fixture' }, api.fetch).generate(source), safeError(502));
  });
}

test('Stripe always creates the fixed £15 GBP product regardless of order price fields', async () => {
  const api = transport({ id: 'cs_test_fixture', url: 'https://checkout.stripe.com/fixture' });
  const stripe = createStripeClient({ STRIPE_SECRET_KEY: 'sk_test_fixture' }, api.fetch);
  assert.equal(stripe.mode, 'test');
  const session = await stripe.createCheckout({ ...order, amount: 1, amount_total: 1, currency: 'usd', price: 1, product: 'injected' }, { success: 'https://example.test/success', cancel: 'https://example.test/cancel' });
  assert.equal(session.id, 'cs_test_fixture');
  const request = api.requests[0], form = new URLSearchParams(request.body);
  assert.equal(request.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(request.method, 'POST');
  assert.equal(headers(request).get('authorization'), 'Bearer sk_test_fixture');
  assert.equal(headers(request).get('Idempotency-Key'), order.id);
  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][quantity]'), '1');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '1500');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'gbp');
  assert.equal(form.get('line_items[0][price_data][product_data][name]'), 'Promotion Fix');
  assert.equal(form.get('metadata[order_id]'), order.id);
  assert.equal(form.get('metadata[product]'), 'promotion_fix_v1');
  assert.equal(form.get('client_reference_id'), order.id);
  assert.equal(form.get('success_url'), 'https://example.test/success');
  assert.equal(form.get('cancel_url'), 'https://example.test/cancel');
});

test('Stripe detects live mode and encodes retrieval ids on its fixed API host', async () => {
  const api = transport({ id: 'cs_live_fixture', url: 'https://checkout.stripe.com/fixture' }, { id: 'cs_live_fixture' });
  const stripe = createStripeClient({ STRIPE_SECRET_KEY: 'sk_live_fixture' }, api.fetch);
  assert.equal(stripe.mode, 'live');
  await stripe.createCheckout(order, { success: 'https://example.test/ok', cancel: 'https://example.test/back' });
  const form = new URLSearchParams(api.requests[0].body);
  assert.equal(form.get('success_url'), 'https://example.test/ok');
  assert.equal(form.get('cancel_url'), 'https://example.test/back');
  await stripe.retrieve('cs_test/../../evil?expand[]=secret');
  assert.equal(api.requests[1].url, 'https://api.stripe.com/v1/checkout/sessions/cs_test%2F..%2F..%2Fevil%3Fexpand%5B%5D%3Dsecret');
});

for (const [name, factory, env, invoke] of [
  ['Neon', createNeonStore, { PROMOTION_DATABASE_URL: databaseUrl }, adapter => adapter.get(order.id)],
  ['Anthropic', createAnthropicModel, { ANTHROPIC_API_KEY: 'sk-ant-fixture' }, adapter => adapter.generate(source)],
  ['Stripe', createStripeClient, { STRIPE_SECRET_KEY: 'sk_test_fixture' }, adapter => adapter.retrieve('cs_test_fixture')],
]) {
  test(`${name} rejects missing configuration without making a request`, async () => {
    const api = transport();
    await assert.rejects(async () => invoke(factory({}, api.fetch)), safeError(503));
    assert.equal(api.requests.length, 0);
  });
  test(`${name} redacts upstream rejection and network error details`, async () => {
    for (const response of [{ status: 500, body: { error: 'UPSTREAM_SECRET_MARKER' } }, new Error('UPSTREAM_SECRET_MARKER')]) {
      const api = transport(response);
      await assert.rejects(async () => invoke(factory(env, api.fetch)), safeError(502));
    }
  });
}

test('Stripe rejects a key that does not identify test or live mode', async () => {
  const api = transport();
  await assert.rejects(async () => createStripeClient({ STRIPE_SECRET_KEY: 'invalid_UPSTREAM_SECRET_MARKER' }, api.fetch).retrieve('cs_test_fixture'), safeError(503));
  assert.equal(api.requests.length, 0);
});
