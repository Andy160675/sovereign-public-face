import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseCrm } from '../../tools/diagnostic/analyse-crm.mjs';
const record = (extra = {}) => ({ opportunityId: 'opp-001', segment: 'enquiries', sale: 'won', feeMinor: 25000, refundMinor: 0, acquisitionMinor: 2000, sellingMinor: 3000, deliveryMinor: 8000, customerOutcome: 'improved', ...extra });
const doc = records => ({ schemaVersion: '1.0.0', currency: 'GBP', records });

test('empty data has unknown rates rather than invented conversion', () => {
  const report = analyseCrm(doc([]));
  assert.equal(report.total.opportunities, 0);
  assert.equal(report.total.winRateClosed, null);
  assert.equal(report.total.contributionPerOpportunityMinor, null);
  assert.equal(report.status, 'descriptive_only');
  assert.equal(report.routingChanged, false);
});
test('keeps closed-sale denominator separate from open pipeline and all opportunity costs', () => {
  const report = analyseCrm(doc([
    record(),
    record({ opportunityId: 'opp-002', sale: 'lost', feeMinor: 0, acquisitionMinor: 1000, sellingMinor: 1000, deliveryMinor: 0, customerOutcome: 'unknown' }),
    record({ opportunityId: 'opp-003', sale: 'open', feeMinor: 0, acquisitionMinor: 1000, sellingMinor: 0, deliveryMinor: 0, customerOutcome: 'unknown' }),
  ]));
  assert.equal(report.total.opportunities, 3);
  assert.equal(report.total.closed, 2);
  assert.equal(report.total.open, 1);
  assert.equal(report.total.winRateClosed, 0.5);
  assert.equal(report.total.contributionMinor, 9000);
  assert.equal(report.total.contributionPerOpportunityMinor, 3000);
  assert.equal(report.total.customerOutcomes.improved, 1);
  assert.equal(report.total.customerOutcomes.unknown, 2);
});
test('refunds reduce contribution and cannot be hidden by a won status', () => {
  const report = analyseCrm(doc([record({ refundMinor: 25000 })]));
  assert.equal(report.total.won, 1);
  assert.equal(report.total.refundedOpportunities, 1);
  assert.equal(report.total.netFeeMinor, 0);
  assert.equal(report.total.contributionMinor, -13000);
});
test('reports customer outcomes separately from commercial contribution', () => {
  const report = analyseCrm(doc([record({ customerOutcome: 'worse' })]));
  assert.ok(report.total.contributionMinor > 0);
  assert.equal(report.total.customerOutcomes.worse, 1);
  assert.equal(report.status, 'descriptive_only');
});
test('reports per-segment data, including genuinely unknown segment', () => {
  const report = analyseCrm(doc([record({ segment: 'unknown' })]));
  assert.equal(report.segments.unknown.opportunities, 1);
  assert.equal(report.segments.enquiries.opportunities, 0);
});
test('does not emit records or opportunity identifiers', () => {
  const output = JSON.stringify(analyseCrm(doc([record({ opportunityId: 'private-pseudonym-739' })])));
  assert.doesNotMatch(output, /private-pseudonym-739|opportunityId|"records"/);
});
test('duplicate opportunities fail instead of inflating conversion', () => {
  assert.throws(() => analyseCrm(doc([record(), record()])), /duplicate/i);
});
test('schema rejects contact data rather than passing it through', () => {
  for (const extra of [{ email: 'private@example.invalid' }, { name: 'Name' }, { notes: 'private notes' }]) {
    assert.throws(() => analyseCrm(doc([record(extra)])), /fields/i);
  }
  assert.throws(() => analyseCrm({ ...doc([]), contacts: [] }), /fields/i);
});
test('rejects wrong currency, version and malformed arrays', () => {
  for (const invalid of [null, [], {}, { ...doc([]), currency: 'EUR' }, { ...doc([]), schemaVersion: '2.0.0' }, { ...doc([]), records: {} }]) {
    assert.throws(() => analyseCrm(invalid));
  }
});
test('rejects non-integer, negative, nonfinite and excessively large money', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '25000', null, 1_000_000_001]) {
    assert.throws(() => analyseCrm(doc([record({ feeMinor: value })])), /money/i);
  }
});
test('rejects inconsistent refunds, non-sale fees and unsupported outcomes', () => {
  for (const extra of [{ refundMinor: 25001 }, { sale: 'lost' }, { sale: 'open' }, { segment: 'wealthy' }, { customerOutcome: 'guaranteed' }]) {
    assert.throws(() => analyseCrm(doc([record(extra)])));
  }
});
test('rejects identifiers containing email-like or free-text data', () => {
  for (const opportunityId of ['person@example.invalid', 'a person', '', 'a'.repeat(65)]) {
    assert.throws(() => analyseCrm(doc([record({ opportunityId })])), /identifier/i);
  }
});
test('bounded export rejects more than 5000 records', () => {
  assert.throws(() => analyseCrm(doc(Array(5001).fill(record()))), /5000/);
});
test('does not mutate input and does not pretend that descriptive data trained a model', () => {
  const input = doc([record()]);
  const before = JSON.stringify(input);
  const report = analyseCrm(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(report.archetypeStatus, 'provisional_problem_segments');
  assert.match(report.limitations.join(' '), /causal|causation/);
});

// Exercise the real CLI as well as the pure reporting function.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../../tools/diagnostic/analyse-crm.mjs', import.meta.url));
function runInput(input) {
  const dir = mkdtempSync(join(tmpdir(), 'vipfish-crm-test-'));
  try {
    const path = join(dir, 'synthetic.json');
    writeFileSync(path, input);
    return spawnSync(process.execPath, [cli, path], { encoding: 'utf8', timeout: 5000 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('CLI emits a parseable aggregate report for a valid synthetic export', () => {
  const run = runInput(JSON.stringify(doc([record()])));
  assert.equal(run.status, 0);
  assert.equal(run.stderr, '');
  assert.equal(JSON.parse(run.stdout).total.won, 1);
});
test('CLI rejects malformed JSON without echoing customer-data fragments', () => {
  const run = runInput('{"email":"sensitive@example.invalid",BAD}');
  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.doesNotMatch(run.stderr, /sensitive|example\.invalid|email/);
});
test('CLI rejects an oversized file before parsing', () => {
  const run = runInput('x'.repeat(2 * 1024 * 1024 + 1));
  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /size limit/);
});
test('CLI requires one deliberate local export path', () => {
  const run = spawnSync(process.execPath, [cli], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Usage:/);
  assert.equal(run.stdout, '');
});
