#!/usr/bin/env node
/**
 * Fail-closed CI helper: require JARUS_RECEIPT_ENGINE_PATH + SHA256, then npm test.
 * Does not vendor jarus source. No live Stripe.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";

const path = process.env.JARUS_RECEIPT_ENGINE_PATH;
const pin = process.env.JARUS_RECEIPT_ENGINE_SHA256;

function die(msg) {
  console.error(`[ci-with-jarus-pin] ${msg}`);
  process.exit(2);
}

if (!path) die("JARUS_RECEIPT_ENGINE_PATH is required (absolute path to jarus dist entry)");
if (!isAbsolute(path)) die("JARUS_RECEIPT_ENGINE_PATH must be absolute");
if (!pin || !/^[a-f0-9]{64}$/i.test(pin)) die("JARUS_RECEIPT_ENGINE_SHA256 must be 64 hex chars");
if (!existsSync(path)) die(`engine path not found: ${path}`);

const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
if (actual.toLowerCase() !== pin.toLowerCase()) {
  die(`pin mismatch: expected ${pin} got ${actual}`);
}

console.log(`[ci-with-jarus-pin] pin OK ${pin.slice(0, 12)}…`);
const r = spawnSync("npm", ["test"], { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);
