import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const repository = 'Andy160675/sovereign-public-face';
const context = 'jarus/private-stripe-integration';
const description = 'Machine CI: full suite, MySQL, typecheck, build, boundary PASS';
const requireSha = sha => {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('PRIVATE_PROOF_SHA');
};

// Only metadata crosses this boundary. The authenticated reporter must first
// independently verify the native private job and its exact public/source pins.
export function verifyPrivateProof({ sha, statuses, now = Date.now() }) {
  requireSha(sha);
  if (!Array.isArray(statuses) || statuses.length >= 100 ||
      statuses.some(s => !s || !Number.isSafeInteger(s.id) || s.id < 1)) {
    throw new Error('PRIVATE_PROOF_PAYLOAD');
  }
  const matching = statuses.filter(s => typeof s.context === 'string' && s.context.toLowerCase() === context);
  const latest = matching.sort((a, b) => b.id - a.id)[0];
  if (!latest) throw new Error('PRIVATE_PROOF_MISSING');
  if (latest.creator?.id !== 214889381 || latest.context !== context) throw new Error('PRIVATE_PROOF_REPORTER');
  if (latest.url !== `https://api.github.com/repos/${repository}/statuses/${sha}`) throw new Error('PRIVATE_PROOF_COMMIT');
  const created = Date.parse(latest.created_at);
  if (!Number.isFinite(created) || !Number.isFinite(now) || now - created > 24 * 60 * 60 * 1000 || created - now > 5 * 60 * 1000) {
    throw new Error('PRIVATE_PROOF_TIME');
  }
  if (!/^https:\/\/github\.com\/Blade2AI\/codex-sovereign\/actions\/runs\/[1-9][0-9]*\/job\/[1-9][0-9]*$/.test(latest.target_url ?? '')) {
    throw new Error('PRIVATE_PROOF_URL');
  }
  if (latest.state === 'pending') throw new Error('PRIVATE_PROOF_PENDING');
  if (latest.state !== 'success') throw new Error('PRIVATE_PROOF_NOT_SUCCESS');
  if (latest.description !== description) throw new Error('PRIVATE_PROOF_DESCRIPTION');
  return latest.target_url;
}

export async function fetchPrivateProof({ sha, token, now = Date.now(), fetchImpl = fetch }) {
  requireSha(sha);
  if (!token) throw new Error('PRIVATE_PROOF_TOKEN');
  let response, statuses;
  try {
    response = await fetchImpl(`https://api.github.com/repos/${repository}/commits/${sha}/statuses?per_page=100`, {
      redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!response.ok) throw new Error('HTTP');
    statuses = await response.json();
  } catch { throw new Error('PRIVATE_PROOF_API'); }
  return verifyPrivateProof({ sha, statuses, now });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const sha = process.env.PUBLIC_CI_PROOF_SHA;
    requireSha(sha);
    const deadline = Date.now() + 10 * 60 * 1000;
    while (true) {
      try {
        const url = await fetchPrivateProof({ sha, token: process.env.GITHUB_TOKEN });
        console.log(`Authenticated private full-suite proof for ${sha}: ${url}`);
        break;
      } catch (error) {
        if (!['PRIVATE_PROOF_MISSING', 'PRIVATE_PROOF_PENDING'].includes(error.message) || Date.now() >= deadline) throw error;
        console.log(`${error.message}: awaiting exact-commit private result`);
        await delay(15000);
      }
    }
  } catch (error) {
    console.error(`[verify-private-ci-proof] ${error.message}`);
    process.exitCode = 2;
  }
}
