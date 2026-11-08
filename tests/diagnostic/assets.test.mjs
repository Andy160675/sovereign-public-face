import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../client/public/diagnostic/', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

test('page loads only relative, self-hosted assets', () => {
  const html = read('index.html');
  assert.match(html, /type="module" src="\.\/app\.mjs"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /(?:src|href)="https?:/i);
});
test('page explicitly blocks network connections, form submission and indexing', () => {
  const html = read('index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});
test('form has native semantics and no unready checkout', () => {
  const html = read('index.html');
  for (const expected of [/<fieldset/, /<legend/, /id="question-title"/, /aria-live="polite"/, /<noscript>/, /type="submit"/]) assert.match(html, expected);
  assert.doesNotMatch(html, /(?:action|href)="[^\"]*(?:checkout|stripe|payment)/i);
  assert.match(html, /No payment/);
  assert.match(html, /href="\/contact"/);
});
test('UI uses text nodes, with no tracking, persistence or answer transmission', () => {
  const source = read('app.mjs');
  assert.match(source, /textContent/);
  assert.match(source, /createObjectURL/);
  assert.match(source, /revokeObjectURL/);
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|location\.search/);
});
test('UI supports back, restart, safe download and focus updates', () => {
  const source = read('app.mjs');
  for (const expected of [/rewind\(/, /\.focus\(/, /\.preventDefault\(/, /\.download\s*=/, /application\/json/]) assert.match(source, expected);
});
test('layout supports narrow screens, focus visibility and reduced motion', () => {
  const css = read('styles.css');
  assert.match(css, /@media/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\[hidden\]/);
});
test('diagnostic assets bypass the SPA catch-all without changing payment routes', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const catchAll = config.rewrites.findIndex(rule => rule.source === '/((?!api/).*)');
  assert.ok(catchAll >= 0);
  for (const file of ['index.html', 'app.mjs', 'engine.mjs', 'styles.css']) {
    const path = `/diagnostic/${file}`;
    const index = config.rewrites.findIndex(rule => rule.source === path && rule.destination === path);
    assert.ok(index >= 0 && index < catchAll, `${path} needs a static exemption`);
  }
  assert.ok(config.rewrites.some(rule => rule.source === '/api/stripe/webhook' && rule.destination === '/api/stripe/webhook'));
});
test('every shipped module remains free of network, storage and internal service references', () => {
  for (const file of ['app.mjs', 'engine.mjs']) {
    assert.doesNotMatch(read(file), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|https?:\/\/|\/api\/|\/portal/);
  }
});
