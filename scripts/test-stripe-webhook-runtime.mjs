// Characterization: the emitted webhook closure must load in native Node ESM.
// Uses real public dependencies. Does not contact Stripe or provision a database.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const source = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const output = await mkdtemp(join(source, '.runtime-smoke-'));
const paths = [
  'api/stripe/webhook.ts',
  'server/createStripeWebhookApp.ts',
  'server/stripe-webhook.ts',
  'server/stripe-receipt-store.ts',
];
let server;
try {
  await writeFile(join(output, 'package.json'), '{"type":"module"}');
  for (const path of paths) {
    const input = await readFile(join(source, path), 'utf8');
    const compiled = ts.transpileModule(input, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        esModuleInterop: true,
        isolatedModules: true,
      },
    });
    const destination = join(output, path.replace(/\.ts$/, '.js'));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, compiled.outputText);
  }
  // Never inherit any actual payment/database/engine credentials into this test.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('STRIPE_') || key.startsWith('JARUS_')) delete process.env[key];
  }
  process.env.STRIPE_SECRET_KEY = 'sk_test_runtime_smoke_dummy';
  const { default: app } = await import(pathToFileURL(join(output, 'api/stripe/webhook.js')).href);
  assert.equal(typeof app, 'function');
  server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/stripe/webhook`;
  const get = await fetch(url);
  assert.equal(get.status, 404, 'GET loads handler without providing a POST acknowledgement');
  const empty = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '',
  });
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { error: 'Malformed request' });
  const unconfigured = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(unconfigured.status, 500);
  assert.deepEqual(await unconfigured.json(), { error: 'Receipt storage fault' });
  console.log('PASS: emitted ESM closure loads; GET 404; empty POST 400; unconfigured POST fails closed with 500.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(output, { recursive: true, force: true });
}
