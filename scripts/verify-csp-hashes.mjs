#!/usr/bin/env node
/**
 * Keep `script-src` in step with the inline scripts actually shipped.
 *
 * The CSP pins each inline script in `dist/public/index.html` by SHA-256, which
 * is what lets `script-src` avoid `'unsafe-inline'` and therefore actually block
 * injected script. The hashes are stable because they come from a pinned
 * dependency — `vite-plugin-manus-runtime` inlines its runtime, and
 * `client/index.html` carries a service-worker registration — but "stable"
 * is not "guaranteed": bumping that plugin, or editing the inline snippet,
 * changes the bytes.
 *
 * Without this check the failure mode is the worst kind: the build succeeds, the
 * deploy succeeds, and the site is blank in production because the browser
 * refused the runtime. A CSP whose hashes have silently drifted is more
 * dangerous than no CSP, because nobody is watching for it.
 *
 * So: compare the built output against both places the policy is declared —
 * `vercel.json` (static deployment) and `server/_core/securityHeaders.ts` (the
 * Express host that serves /api/trpc and /api/oauth) — and fail if they
 * disagree. Run after `vite build`.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const builtIndex = join(repoRoot, "dist", "public", "index.html");

if (!existsSync(builtIndex)) {
  console.error(`verify-csp-hashes: ${builtIndex} is missing — run \`vite build\` first.`);
  process.exit(2);
}

/** Inline = a <script> with no src attribute. */
function inlineScriptHashes(html) {
  const hashes = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const digest = createHash("sha256").update(match[1], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

const built = inlineScriptHashes(readFileSync(builtIndex, "utf8"));

if (built.length === 0) {
  // Not "clean": a selector that matches nothing would make this check pass
  // while verifying nothing at all.
  console.error(
    "verify-csp-hashes: found NO inline scripts in the built index.html.\n" +
      "That is suspicious rather than clean — the extractor has probably stopped matching.",
  );
  process.exit(1);
}

const sources = [
  {
    label: "vercel.json",
    policy: (() => {
      const config = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
      const catchAll = (config.headers ?? []).find(entry => entry.source === "/(.*)");
      const header = (catchAll?.headers ?? []).find(h => h.key === "Content-Security-Policy");
      return header?.value ?? "";
    })(),
  },
  {
    label: "server/_core/securityHeaders.ts",
    policy: readFileSync(join(repoRoot, "server", "_core", "securityHeaders.ts"), "utf8"),
  },
];

let failed = false;

for (const { label, policy } of sources) {
  if (!policy) {
    console.error(`verify-csp-hashes: no Content-Security-Policy found in ${label}.`);
    failed = true;
    continue;
  }

  const missing = built.filter(hash => !policy.includes(hash));
  const declared = [...policy.matchAll(/'sha256-[A-Za-z0-9+/=]+'/g)].map(m => m[0]);
  const stale = declared.filter(hash => !built.includes(hash));

  if (missing.length === 0 && stale.length === 0) {
    console.log(`verify-csp-hashes: ${label} — ${built.length} inline script hash(es) match.`);
    continue;
  }

  failed = true;
  console.error(`verify-csp-hashes: ${label} is out of step with the built output.`);
  for (const hash of missing) console.error(`  shipped but NOT allowed by the policy: ${hash}`);
  for (const hash of stale) console.error(`  allowed by the policy but not shipped: ${hash}`);
}

if (failed) {
  console.error(
    "\nThe browser will refuse any inline script the policy does not list, so this " +
      "would deploy a blank page.\nUpdate the hashes in both places to the shipped values above. " +
      "Do NOT add 'unsafe-inline' to make this pass — that is the protection this check exists to keep.",
  );
  process.exit(1);
}

console.log("verify-csp-hashes: PASS — the CSP and the shipped inline scripts agree.");
