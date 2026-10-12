// Compile the reviewed canonical receipt component only in a private runner.
// No fetching, credentials, fallback engine, source vendoring or live services.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const checkout = realpathSync(resolve(import.meta.dirname, '..'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function realDestination(path) {
  const remaining = [];
  let ancestor = resolve(path);
  while (!existsSync(ancestor)) {
    remaining.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  return join(realpathSync(ancestor), ...remaining);
}

export function prepareReceiptRuntime({ sourcePath, outputDirectory, pin }) {
  if (!pin || !/^[a-f0-9]{64}$/.test(pin.source_sha256) || !/^[a-f0-9]{64}$/.test(pin.engine_sha256)) {
    throw new Error('INVALID_PIN');
  }
  if (ts.version !== pin.compiler) throw new Error('COMPILER_VERSION_MISMATCH');
  if (!sourcePath || !outputDirectory || /[\r\n]/.test(sourcePath + outputDirectory)) throw new Error('INVALID_PATH');
  const output = realDestination(outputDirectory);
  if (/[\r\n]/.test(output)) throw new Error('INVALID_PATH');
  const inside = relative(checkout, output);
  if (output === checkout || (!isAbsolute(inside) && inside !== '..' && !inside.startsWith('../') && !inside.startsWith('..\\'))) {
    throw new Error('OUTPUT_MUST_BE_OUTSIDE_CHECKOUT');
  }
  const source = readFileSync(sourcePath);
  if (sha(source) !== pin.source_sha256) throw new Error('SOURCE_PIN_MISMATCH');
  const compiled = ts.transpileModule(source.toString('utf8'), {
    fileName: 'receipt-engine.ts',
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, sourceMap: false, declaration: false,
    },
    reportDiagnostics: true,
  });
  if (compiled.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) throw new Error('COMPILE_FAILED');
  if (sha(compiled.outputText) !== pin.engine_sha256) throw new Error('ENGINE_PIN_MISMATCH');
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const entry = join(output, 'receipt-engine.cjs');
  writeFileSync(entry, compiled.outputText, { flag: 'wx', mode: 0o600 });
  return entry;
}

let directlyInvoked = false;
try {
  directlyInvoked = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
} catch { /* Imports from stdin/eval do not have an entry-point pathname. */ }

if (directlyInvoked) {
  try {
    const pin = JSON.parse(readFileSync(new URL('./jarus-ci-pin.json', import.meta.url), 'utf8'));
    const entry = prepareReceiptRuntime({
      sourcePath: process.env.JARUS_CI_SOURCE_PATH,
      outputDirectory: process.env.JARUS_CI_OUTPUT_DIR,
      pin,
    });
    if (process.env.GITHUB_ENV) {
      appendFileSync(process.env.GITHUB_ENV, `JARUS_RECEIPT_ENGINE_PATH=${entry}\nJARUS_RECEIPT_ENGINE_SHA256=${pin.engine_sha256}\n`);
    }
    console.log(`Canonical receipt component admitted: ${pin.engine_sha256}`);
  } catch (error) {
    console.error(`Receipt component preparation refused: ${error.code ?? error.message}`);
    process.exitCode = 2;
  }
}
