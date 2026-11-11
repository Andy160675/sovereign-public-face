#!/usr/bin/env node
import { readdirSync, readFileSync, lstatSync, realpathSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
function isMainModule(url) { try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url)); } catch { return false; } }

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_TARGETS = ["client", "server"];
const BUILD_TARGETS = ["dist/public"];
const IGNORED = new Set(["node_modules", ".git", ".cache", "coverage"]);
const EXTENSIONS = new Set([".css", ".html", ".htm", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".svg", ".json"]);
const RULES = [
  ["external font provider", /fonts\.(?:googleapis|gstatic)\.com|(?:use|p)\.typekit\.net|fonts\.adobe\.com|fonts\.bunny\.net/i],
  ["remote @font-face", /@font-face\s*\{[^}]*\bsrc\s*:[^;}]*url\(\s*['"]?(?:https?:)?\/\//i],
  ["remote CSS @import", /@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i],
  ["remote font file URL", /(?:https?:)?\/\/[^'"\s)]+\.(?:woff2?|ttf|otf|eot)(?:[?#][^'"\s)]*)?/i],
];

export function scanFontPolicy(root, { built = false } = {}) {
  const failures = [];
  let checked = 0;
  let builtChecked = 0;
  function walk(path, isBuild, optional = false) {
    let stat;
    try { stat = lstatSync(path); } catch (error) {
      if (optional && error.code === "ENOENT") return;
      failures.push(relative(root, path) + ": cannot inspect (" + error.code + ")");
      return;
    }
    if (stat.isSymbolicLink()) {
      failures.push(relative(root, path) + ": symbolic link cannot be audited");
      return;
    }
    if (stat.isDirectory()) {
      try {
        for (const name of readdirSync(path)) {
          if (!IGNORED.has(name)) walk(join(path, name), isBuild);
        }
      } catch (error) {
        failures.push(relative(root, path) + ": cannot read directory (" + error.code + ")");
      }
      return;
    }
    if (!EXTENSIONS.has(extname(path).toLowerCase())) return;
    let content;
    try { content = readFileSync(path, "utf8"); } catch (error) {
      failures.push(relative(root, path) + ": cannot read (" + error.code + ")");
      return;
    }
    checked++;
    if (isBuild && extname(path).toLowerCase() !== ".json") builtChecked++;
    for (const [rule, pattern] of RULES) {
      if (pattern.test(content)) failures.push(relative(root, path) + ": " + rule);
    }
  }
  // client is mandatory; optional roots must not turn IO failures into PASS.
  for (const target of SOURCE_TARGETS) walk(join(root, target), false, target !== "client");
  if (built) for (const target of BUILD_TARGETS) walk(join(root, target), true, true);
  if (checked === 0) failures.push("no auditable source or asset files found");
  if (built && builtChecked === 0) failures.push("no auditable built assets found");
  return { checked, builtChecked, failures };
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--built")) {
    console.error("usage: node scripts/font-policy-check.mjs [--built]");
    process.exitCode = 2;
  } else {
    const { checked, failures } = scanFontPolicy(ROOT, { built: args.includes("--built") });
    if (failures.length) {
      console.error("FONT-001 FAIL:\n" + failures.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("FONT-001 PASS: " + checked + " files checked; no external font service/file references detected.");
    }
  }
}

