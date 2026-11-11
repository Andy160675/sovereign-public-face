import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import test from "node:test";
import { scanFontPolicy } from "./font-policy-check.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "font-policy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, put(path, content) {
    const dest = join(root, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }};
}

test("accepts system fonts and bundled same-origin font declarations", (t) => {
  const f = fixture(t);
  f.put("client/styles.css", "@font-face{font-family:Local;src:url('/fonts/local.woff2')} body{font-family:system-ui}");
  assert.deepEqual(scanFontPolicy(f.root).failures, []);
});

for (const output of ["dist/public"]) {
  test("rejects external fonts in " + output, (t) => {
    const f = fixture(t);
    f.put("client/main.js", "export default 1");
    f.put(output + "/static/app.css", "@font-face{font-family:Remote;src:url(https://example.invalid/font.woff2)}");
    assert.ok(scanFontPolicy(f.root, { built: true }).failures.some(x => x.includes("remote @font-face")));
  });
}

test("post-build mode rejects absent outputs even with clean source", (t) => {
  const f = fixture(t);
  f.put("client/main.js", "export default 1");
  assert.ok(scanFontPolicy(f.root, { built: true }).failures.includes("no auditable built assets found"));
});

test("post-build mode accepts audited local assets", (t) => {
  const f = fixture(t);
  f.put("client/main.js", "export default 1");
  f.put("dist/public/app.css", "body{font-family:system-ui}");
  assert.deepEqual(scanFontPolicy(f.root, { built: true }).failures, []);
});

test("deployment metadata alone does not qualify as built assets", (t) => {
  const f = fixture(t);
  f.put("client/main.js", "export default 1");
  f.put("dist/public/config.json", "{}");
  assert.ok(scanFontPolicy(f.root, { built: true }).failures.includes("no auditable built assets found"));
});

test("missing source never produces an empty pass", (t) => {
  const f = fixture(t);
  assert.ok(scanFontPolicy(f.root).failures.length > 0);
});

test("broken source symlinks fail closed without following them", (t) => {
  const f = fixture(t);
  try {
    symlinkSync(join(f.root, "missing"), join(f.root, "client"), "junction");
  } catch (error) {
    if (error.code === "EPERM") return t.skip("host cannot create junction/symlink");
    throw error;
  }
  assert.ok(scanFontPolicy(f.root).failures.some(x => x.includes("symbolic link")));
});

test("source-only mode permits rebuilding stale output, while post-build still refuses it", (t) => {
 const f=fixture(t); f.put("client/index.html","<html>Local fonts</html>");
 f.put("dist/public/app.css","@import url(https://fonts.googleapis.com/css2?family=Example);");
 assert.deepEqual(scanFontPolicy(f.root).failures,[]);
 assert.ok(scanFontPolicy(f.root,{built:true}).failures.length>0);
});
