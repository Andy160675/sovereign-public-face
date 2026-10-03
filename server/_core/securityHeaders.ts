import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Security headers for the Express host.
 *
 * `vercel.json` carries a header block, and it was easy to assume that covered
 * the app. It does not. Vercel serves the static bundle plus three functions
 * (`api/stripe/webhook`, `api/promotion-fix`, `api/promotion-fix-webhook`) and
 * its rewrite excludes `/api/`, so there is no Vercel function behind
 * `/api/trpc` or `/api/oauth/callback` at all. Those are mounted here, in
 * `_core/index.ts` — which means the session cookie, the OAuth callback and
 * checkout all run on *this* host, and this host was sending no security
 * headers whatsoever.
 *
 * So the authenticated surface — the part worth protecting — had none of the
 * protection that had been added to the static one.
 *
 * The policy is deliberately the same as the `vercel.json` block, so the two
 * deployments do not disagree about what is allowed. They are separate files
 * because one is static JSON read by the platform and the other is middleware;
 * `scripts/verify-csp-hashes.mjs` keeps the script-src hashes in step with the
 * built output for both.
 */

/** Inline scripts the built `index.html` carries, by SHA-256. */
export const INLINE_SCRIPT_HASHES = [
  // vite-plugin-manus-runtime's inlined runtime (`<script id="manus-runtime">`).
  "'sha256-Eoj6XODkFF87BVabaKx38kr7sC0DCgv0l0N3CdsTja8='",
  // The service-worker registration at the bottom of client/index.html.
  "'sha256-z4rPIEJio2qUftdaNM9MWKWwZBo8naTefeiV/6zqth0='",
];

export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' ${INLINE_SCRIPT_HASHES.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://d2xsxph8kpxj0f.cloudfront.net",
    "connect-src 'self' https://forge.butterfly-effect.dev",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * HSTS is set only on a request that actually arrived over TLS. Sending it on a
 * plaintext request is ignored by browsers anyway, and setting it in local
 * development would pin http://localhost to https in the developer's browser.
 */
function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  if (!forwarded) return false;
  const protocols = Array.isArray(forwarded) ? forwarded : forwarded.split(",");
  return protocols.some(proto => proto.trim().toLowerCase() === "https");
}

export function securityHeaders(): RequestHandler {
  const csp = contentSecurityPolicy();

  return function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // Not asserted for subdomains. This deployment is a leaf of a shared parent
    // domain, so includeSubDomains here would only speak for our own subdomains,
    // and asserting anything about the parent is not ours to do.
    if (isSecureRequest(req)) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }

    next();
  };
}
