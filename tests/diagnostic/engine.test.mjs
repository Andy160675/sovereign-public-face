import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFERS, MAX_QUESTIONS, getQuestion, answer, rewind, getResult } from '../../client/public/diagnostic/engine.mjs';

const choices = { pain: 'enquiries', enquiries_detail: 'reply', admin_detail: 'rekey', quality_detail: 'handoff', clarify: 'enquiries', frequency: 'daily', evidence: 'examples', scope: 'one', help: 'focused' };
function complete(overrides = {}) {
  const selected = { ...choices, ...overrides };
  let transcript = [];
  for (let i = 0; i <= 7; i++) {
    const question = getQuestion(transcript);
    if (!question) return transcript;
    transcript = answer(transcript, question.id, selected[question.id]);
  }
  assert.fail('Questionnaire did not terminate');
}

test('starts at pain, with no preselected answer', () => {
  assert.equal(getQuestion([])?.id, 'pain');
  assert.equal(getQuestion([])?.defaultValue, undefined);
});
test('routes each identified pain to its own question', () => {
  for (const pain of ['enquiries', 'admin', 'quality']) {
    assert.equal(getQuestion(answer([], 'pain', pain)).id, `${pain}_detail`);
  }
});
test('unknown pain asks clarification and permits an unresolved exit', () => {
  const first = answer([], 'pain', 'unknown');
  assert.equal(getQuestion(first).id, 'clarify');
  const done = answer(first, 'clarify', 'unknown');
  assert.equal(getQuestion(done), null);
  assert.equal(getResult(done).segment.id, 'unknown');
  assert.equal(getResult(done).recommendation.id, 'snapshot');
});
test('known path asks six questions; clarified path asks seven', () => {
  assert.equal(complete().length, 6);
  assert.equal(complete({ pain: 'unknown', clarify: 'admin' }).length, 7);
  assert.equal(MAX_QUESTIONS, 7);
});
test('explicit focused help for an evidenced pain recommends Teardown', () => {
  const result = getResult(complete());
  assert.equal(result.recommendation.id, 'teardown');
  assert.equal(result.recommendation.priceMinor, 25000);
  assert.match(result.recommendation.reason, /focused/i);
});
test('audit needs explicit intent, several processes and measured evidence', () => {
  assert.equal(getResult(complete({ scope: 'several', evidence: 'measured', help: 'audit' })).recommendation.id, 'signal_audit');
  for (const overrides of [{ scope: 'one' }, { evidence: 'examples' }, { help: 'focused' }]) {
    const result = getResult(complete({ scope: 'several', evidence: 'measured', help: 'audit', ...overrides }));
    assert.equal(result.recommendation.id, 'teardown');
  }
});
for (const overrides of [
  { help: 'free' }, { help: 'unknown' }, { evidence: 'none' },
  { frequency: 'unknown' }, { scope: 'unknown' }, { enquiries_detail: 'unknown' },
]) {
  test(`uncertainty or no paid intent stays free: ${JSON.stringify(overrides)}`, () => {
    assert.equal(getResult(complete(overrides)).recommendation.id, 'snapshot');
  });
}
test('offers are fixed GBP prices and never purchasable', () => {
  assert.deepEqual(Object.values(OFFERS).map(o => o.priceMinor), [0, 25000, 75000]);
  for (const offer of Object.values(OFFERS)) {
    assert.equal(offer.currency, 'GBP');
    assert.equal(offer.purchasable, false);
    assert.ok(Object.isFrozen(offer));
  }
  assert.throws(() => { OFFERS.teardown.priceMinor = 1; }, TypeError);
});
test('results distinguish provisional self-report from verification and P95', () => {
  const result = getResult(complete());
  assert.equal(result.segment.validation, 'provisional');
  assert.equal(result.evidence.verification, 'unverified');
  assert.equal(result.evidence.confidence, null);
  assert.equal(result.quality.score, null);
  assert.equal(result.quality.status, 'not_assessed');
  assert.deepEqual(result.externalEffects, []);
  assert.equal(result.status, 'recommendation_only');
  assert.equal(result.receiptType, 'unsigned_user_brief');
});
test('result is deterministic and does not claim savings', () => {
  assert.deepEqual(getResult(complete()), getResult(complete()));
  assert.equal(getResult(complete()).verifiedSavingsMinor, null);
  assert.ok(getResult(complete()).suggestedCheck.length > 20);
});
test('different detail/frequency/scope/evidence answers change the brief', () => {
  const base = JSON.stringify(getResult(complete()));
  for (const overrides of [{ enquiries_detail: 'follow_up' }, { frequency: 'weekly' }, { scope: 'several' }, { evidence: 'measured' }]) {
    assert.notEqual(JSON.stringify(getResult(complete(overrides))), base);
  }
});
test('answer and rewind do not mutate inputs, and rewind discards stale branches', () => {
  const original = complete();
  const saved = JSON.stringify(original);
  const edited = answer(rewind(original, 0), 'pain', 'admin');
  assert.equal(edited.length, 1);
  assert.equal(getQuestion(edited).id, 'admin_detail');
  assert.equal(JSON.stringify(original), saved);
  const copy = rewind(original, original.length);
  copy[0].optionId = 'quality';
  assert.equal(original[0].optionId, 'enquiries');
});
test('rejects incomplete result and answers after completion', () => {
  assert.throws(() => getResult([]), /complete/i);
  assert.throws(() => answer(complete(), 'help', 'audit'), /complete/i);
});
test('rejects wrong question, invalid option and HTML-like data', () => {
  assert.throws(() => answer([], 'help', 'audit'), /question/i);
  for (const option of ['<script>alert(1)</script>', '__proto__', '', 1, null]) {
    assert.throws(() => answer([], 'pain', option), /option/i);
  }
});
test('rejects malformed, unknown-field, duplicate and out-of-order transcripts', () => {
  for (const malformed of [null, {}, '[]', [null], [{ questionId: 'pain' }],
    [{ questionId: 'pain', optionId: 'admin', email: 'not-accepted' }],
    [{ questionId: 'help', optionId: 'audit' }],
    [{ questionId: 'pain', optionId: 'admin' }, { questionId: 'pain', optionId: 'admin' }],
    Array(8).fill({ questionId: 'pain', optionId: 'admin' }),
    JSON.parse('[{"questionId":"pain","optionId":"admin","__proto__":{}}]'),
  ]) assert.throws(() => getQuestion(malformed));
});
test('rejects invalid rewind indices', () => {
  for (const index of [-1, 10, 1.5, NaN, '1']) assert.throws(() => rewind(complete(), index));
});
test('question catalogue is immutable', () => {
  const question = getQuestion([]);
  assert.ok(Object.isFrozen(question));
  assert.ok(Object.isFrozen(question.options));
  assert.ok(Object.isFrozen(question.options[0]));
});
test('every legal path terminates by seven, has an explanation and respects paid guards', () => {
  let terminals = 0;
  const offers = new Set();
  function walk(transcript) {
    assert.ok(transcript.length <= 7);
    const question = getQuestion(transcript);
    if (question) {
      assert.ok(!transcript.some(a => a.questionId === question.id));
      for (const option of question.options) walk(answer(transcript, question.id, option.id));
      return;
    }
    const result = getResult(transcript);
    terminals++;
    offers.add(result.recommendation.id);
    assert.ok(result.recommendation.reason.length > 20);
    assert.equal(result.recommendation.purchasable, false);
    const values = Object.fromEntries(transcript.map(a => [a.questionId, a.optionId]));
    if (result.recommendation.id !== 'snapshot') {
      assert.ok(['focused', 'audit'].includes(values.help));
      assert.notEqual(values.evidence, 'none');
      assert.notEqual(values.scope, 'unknown');
      assert.notEqual(values.frequency, 'unknown');
      assert.notEqual(values[`${result.segment.id}_detail`], 'unknown');
    }
    if (result.recommendation.id === 'signal_audit') {
      assert.equal(values.scope, 'several');
      assert.equal(values.evidence, 'measured');
      assert.equal(values.help, 'audit');
    }
  }
  walk([]);
  assert.equal(terminals, 3457);
  assert.deepEqual([...offers].sort(), ['signal_audit', 'snapshot', 'teardown']);
});
