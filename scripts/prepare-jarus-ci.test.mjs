import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
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

test('canonicalized output paths containing CR or LF refuse before output or environment writes', () => {
  const root = mkdtempSync(join(tmpdir(), 'receipt-pin-canonical-path-'));
  const cliDirectory = mkdtempSync(join(import.meta.dirname, 'receipt-pin-cli-'));
  try {
    // Exercise the real CLI with the public synthetic fixture and its matching pin.
    const cli = join(cliDirectory, 'prepare-jarus-ci.mjs');
    copyFileSync(new URL('./prepare-jarus-ci.mjs', import.meta.url), cli);
    writeFileSync(join(cliDirectory, 'jarus-ci-pin.json'), JSON.stringify(pin));
    const input = join(root, 'source.ts');
    writeFileSync(input, source);
    for (const [label, delimiter] of [['lf', '\n'], ['cr', '\r']]) {
      const target = join(root, `runtime${delimiter}JARUS_CI_TEST_INJECTED=1`);
      mkdirSync(target);
      const alias = join(root, `alias-${label}`);
      symlinkSync(target, alias, 'dir');
      const output = join(target, 'compiled-runtime');
      const envFile = join(root, `github-env-${label}`);
      const before = 'EXISTING_ENV=untouched\n';
      writeFileSync(envFile, before);
      const child = spawnSync(process.execPath, [cli], {
        encoding: 'utf8',
        env: { ...process.env, JARUS_CI_SOURCE_PATH: input, JARUS_CI_OUTPUT_DIR: join(alias, 'compiled-runtime'), GITHUB_ENV: envFile },
      });
      assert.equal(child.status, 2, `${label}: ${child.stderr}`);
      assert.match(child.stderr, /INVALID_PATH/);
      assert.equal(child.stdout, '');
      assert.equal(existsSync(output), false);
      assert.equal(readFileSync(envFile, 'utf8'), before);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(cliDirectory, { recursive: true, force: true });
  }
});
