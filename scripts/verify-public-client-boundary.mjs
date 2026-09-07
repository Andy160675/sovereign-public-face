import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const clientRoot = join(repositoryRoot, "client", "src");
const bundleRoot = join(repositoryRoot, "dist", "public");
const portalPath = join(clientRoot, "pages", "Portal.tsx");
const requireBundle = process.argv.includes("--require-bundle");

const prohibitedPatterns = [
  ["internal command-directory copy", /Sovereign Command Directory/i],
  ["internal Manus deployment URL", /https:\/\/[a-z0-9.-]+\.manus\.space\b/i],
  ["domain-expiry inventory", /\bExpires?\s+\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}\b/],
  ["mail-service port inventory", /\b(?:IMAP|SMTP)\s+\d{2,5}\b/i],
  ["API-key inventory metadata", /\bAPI hosting\s+[^\n]*\bKey\b/i],
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css", ".map"].includes(extname(path))
      ? [path]
      : [];
  });
}

const violations = [];

if (existsSync(portalPath)) {
  violations.push("client/src/pages/Portal.tsx must not exist in the public client");
}

const scanRoots = [clientRoot];
if (existsSync(bundleRoot)) {
  scanRoots.push(bundleRoot);
} else if (requireBundle) {
  violations.push("dist/public is missing; build the production bundle before verification");
}

for (const root of scanRoots) {
  for (const path of sourceFiles(root)) {
    const source = readFileSync(path, "utf8");
    for (const [label, pattern] of prohibitedPatterns) {
      if (pattern.test(source)) {
        violations.push(`${relative(repositoryRoot, path)}: ${label}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Public-client boundary verification failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    requireBundle
      ? "Public-client source and production bundle verified: no operational directory data found."
      : "Public-client source verified: no operational directory data found.",
  );
}
