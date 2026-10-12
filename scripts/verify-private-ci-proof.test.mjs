import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { verifyPrivateProof, fetchPrivateProof } from './verify-private-ci-proof.mjs';

const sha = 'a'.repeat(40);
const now = Date.parse('2026-10-12T00:00:00Z');
const status = {
  id: 10, context: 'jarus/private-stripe-integration', state: 'success',
  creator: { id: 214889381, login: 'Andy160675' },
  url: `https://api.github.com/repos/Andy160675/sovereign-public-face/statuses/${sha}`,
  target_url: 'https://github.com/Blade2AI/codex-sovereign/actions/runs/123/job/456',
  description: 'Machine CI: full suite, MySQL, typecheck, build, boundary PASS',
  created_at: '2026-10-11T23:59:00Z',
};
const verify = statuses => verifyPrivateProof({ sha, statuses, now });

test('admits an authenticated exact-commit private full-suite result', () => {
  assert.equal(verify([{ ...status, context: 'unrelated' }, status]), status.target_url);
});
test('missing proof and pending proof refuse', () => {
  assert.throws(() => verify([]), /PRIVATE_PROOF_MISSING/);
  assert.throws(() => verify([{ ...status, state: 'pending' }]), /PRIVATE_PROOF_PENDING/);
});
test('a newer failure supersedes an older success regardless of response order', () => {
  const failed = { ...status, id: 11, state: 'failure' };
  for (const statuses of [[status, failed], [failed, status]]) {
    assert.throws(() => verify(statuses), /PRIVATE_PROOF_NOT_SUCCESS/);
  }
});
test('a different actor cannot supply or supersede trusted proof', () => {
  assert.throws(() => verify([status, { ...status, id: 11, creator: { id: 1, login: 'Andy160675' } }]), /PRIVATE_PROOF_REPORTER/);
});
test('proof attached to another commit is refused', () => {
  assert.throws(() => verify([{ ...status, url: status.url.replace(sha, 'b'.repeat(40)) }]), /PRIVATE_PROOF_COMMIT/);
});
test('stale, future or malformed timestamps are refused', () => {
  for (const created_at of ['2026-10-10T00:00:00Z', '2026-10-12T01:00:00Z', 'invalid']) {
    assert.throws(() => verify([{ ...status, created_at }]), /PRIVATE_PROOF_TIME/);
  }
});
test('only the private native job URL is admitted', () => {
  for (const target_url of [
    'https://github.com.evil.test/Blade2AI/codex-sovereign/actions/runs/123/job/456',
    'https://github.com/Other/repo/actions/runs/123/job/456',
    `${status.target_url}?fake=1`, `${status.target_url}#fake`,
  ]) assert.throws(() => verify([{ ...status, target_url }]), /PRIVATE_PROOF_URL/);
});
test('malformed payload, ambiguous pagination and invalid commit refuse', () => {
  for (const statuses of [null, {}, Array(100).fill(status)]) {
    assert.throws(() => verify(statuses), /PRIVATE_PROOF_PAYLOAD/);
  }
  assert.throws(() => verifyPrivateProof({ sha: 'main', statuses: [status], now }), /PRIVATE_PROOF_SHA/);
});
test('a generic success without the complete machine-proof statement refuses', () => {
  assert.throws(() => verify([{ ...status, description: 'looks good' }]), /PRIVATE_PROOF_DESCRIPTION/);
});
test('API read binds the exact commit and forbids redirects', async () => {
  const proof = await fetchPrivateProof({ sha, token: 'synthetic', now,
    fetchImpl: async (url, options) => {
      assert.equal(url, `https://api.github.com/repos/Andy160675/sovereign-public-face/commits/${sha}/statuses?per_page=100`);
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer synthetic');
      return { ok: true, json: async () => [status] };
    },
  });
  assert.equal(proof, status.target_url);
});
test('network and HTTP errors never expose token or response content', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('synthetic-secret'); },
    async () => ({ ok: false, status: 403, json: async () => ({ secret: 'synthetic-secret' }) }),
  ]) await assert.rejects(fetchPrivateProof({ sha, token: 'synthetic-secret', now, fetchImpl }), error => {
    assert.match(error.message, /PRIVATE_PROOF_API/);
    assert.equal(error.message.includes('synthetic-secret'), false);
    return true;
  });
});
test('CLI fails immediately without an exact commit and importing stays inert', () => {
  const cli = new URL('./verify-private-ci-proof.mjs', import.meta.url);
  const denied = spawnSync(process.execPath, [cli.pathname], {
    env: { ...process.env, PUBLIC_CI_PROOF_SHA: '', GITHUB_TOKEN: '' }, encoding: 'utf8',
  });
  assert.equal(denied.status, 2);
  assert.match(denied.stderr, /PRIVATE_PROOF_SHA/);
  const imported = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `await import(${JSON.stringify(cli.href)});`, encoding: 'utf8',
  });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, '');
});
