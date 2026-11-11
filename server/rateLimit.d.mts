/**
 * Types for `server/rateLimit.mjs`.
 *
 * The implementation is plain ESM so that `api/promotion-fix.js` (JavaScript)
 * and the TypeScript Express host can share one module rather than keeping two
 * notions of the same budgets and env vars. This declaration file is what lets
 * the TypeScript side import it under `strict`.
 */

export const WINDOW: string;
export const OAUTH_LIMIT: number;
export const API_LIMIT: number;
export const PROMOTION_LIMIT: number;

/** A request shaped enough to key a bucket from — Express or Node's own. */
export type KeyableRequest = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | undefined } | undefined;
};

/** The caller's bucket key, or null when this request cannot be attributed. */
export function clientKey(req: KeyableRequest | undefined): string | null;

export function consume(
  prefix: string,
  requests: number,
  /** A null key means the caller is unidentifiable; the request is allowed. */
  key: string | null,
): Promise<{ allowed: boolean; retryAfterSeconds: number }>;

export function isRateLimitConfigured(): boolean;

export function resetRateLimitStateForTests(): void;
