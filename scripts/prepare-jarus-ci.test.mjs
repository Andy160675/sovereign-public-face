import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import ts from 'typescript';

// Public synthetic fixture: exercises compilation/pin admission only.
// Canonical receipt semantics run separately against the real private engine.
const source = 'export const GENESIS_HASH = "synthetic";\nexport class ReceiptEngine {}\nexport const canonicalJson = JSON.stringify;\nexport const verifyChain = () => ({ valid: true });\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const compiled = ts.transpileModule(source, { fileName: 'receipt-engine.ts', compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  esModuleInterop: true, sourceMap: false, declaration: false,
} }).outputText;
const pin = { compiler: '5.9.3', source_sha256: sha(source), engine_sha256: sha(compiled) };

test('import from stdin remains inert', () => {
  const moduleUrl = new URL('./prepare-jarus-ci.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `await import(${JSON.stringify(moduleUrl)});`, encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
});

test('pinned compilation produces a loadable entry outside the public checkout', async () => {
  const { prepareReceiptRuntime } = await import('./prepare-jarus-ci.mjs');
  const root = mkdtempSync(join(tmpdir(), 'receipt-pin-'));
  try {
    const input = join(root, 'source.ts');
    writeFileSync(input, source);
    const entry = prepareReceiptRuntime({ sourcePath: input, outputDirectory: join(root, 'private-runtime'), pin });
    assert.equal(sha(readFileSync(entry)), pin.engine_sha256);
    assert.equal(createRequire(import.meta.url)(entry).GENESIS_HASH, 'synthetic');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('altered source, compiled bytes and compiler versions refuse without emitting an entry', async () => {
  const { prepareReceiptRuntime } = await import('./prepare-jarus-ci.mjs');
  const root = mkdtempSync(join(tmpdir(), 'receipt-pin-deny-'));
  try {
    const input = join(root, 'source.ts');
    writeFileSync(input, source);
    const outputDirectory = join(root, 'private-runtime');
    for (const [field, value, error] of [
      ['source_sha256', '0'.repeat(64), /SOURCE_PIN_MISMATCH/],
      ['engine_sha256', '0'.repeat(64), /ENGINE_PIN_MISMATCH/],
      ['compiler', '0.0.0', /COMPILER_VERSION_MISMATCH/],
      ['source_sha256', 'invalid', /INVALID_PIN/],
    ]) {
      assert.throws(() => prepareReceiptRuntime({ sourcePath: input, outputDirectory, pin: { ...pin, [field]: value } }), error);
      assert.equal(existsSync(join(outputDirectory, 'receipt-engine.cjs')), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('existing output is preserved and public checkout output is refused', async () => {
  const { prepareReceiptRuntime } = await import('./prepare-jarus-ci.mjs');
  const root = mkdtempSync(join(tmpdir(), 'receipt-pin-write-'));
  try {
    const input = join(root, 'source.ts');
    writeFileSync(input, source);
    assert.throws(() => prepareReceiptRuntime({ sourcePath: input, outputDirectory: join(import.meta.dirname, 'private-runtime'), pin }), /OUTPUT_MUST_BE_OUTSIDE_CHECKOUT/);
    const options = { sourcePath: input, outputDirectory: join(root, 'private-runtime'), pin };
    const entry = prepareReceiptRuntime(options);
    const before = readFileSync(entry);
    assert.throws(() => prepareReceiptRuntime(options), /EEXIST/);
    assert.deepEqual(readFileSync(entry), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
