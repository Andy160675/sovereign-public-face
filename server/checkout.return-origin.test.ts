import { describe, expect, it } from "vitest";
import { resolveReturnOrigin } from "./routers";

/**
 * Checkout return URLs were built from `req.headers.origin`, falling back to
 * `req.headers.referer`. Both come from the caller, so both let an attacker
 * choose where the customer lands after paying — with the real
 * CHECKOUT_SESSION_ID in the query string.
 *
 * These tests assert the property that fixes it: the request may only SELECT
 * among origins already configured, and can never introduce one. The first case
 * is the original attack, so it fails against the old code and passes now.
 */
describe("resolveReturnOrigin", () => {
  const configured = { PUBLIC_BASE_URL: "https://sovereign.example", NODE_ENV: "production" } as NodeJS.ProcessEnv;

  it("ignores an attacker-supplied Origin and returns the configured one", () => {
    expect(resolveReturnOrigin("https://evil.example", configured)).toBe("https://sovereign.example");
  });

  it("ignores a Referer-shaped value, which is a full URL and not an origin", () => {
    // The old fallback produced "https://evil.example/paid/checkout/success".
    expect(resolveReturnOrigin("https://evil.example/paid", configured)).toBe("https://sovereign.example");
  });

  it("is not fooled by a configured origin used as a prefix of a hostile host", () => {
    expect(resolveReturnOrigin("https://sovereign.example.evil.test", configured)).toBe(
      "https://sovereign.example",
    );
  });

  it("is not fooled by a configured origin appearing as a subdomain-looking suffix", () => {
    expect(resolveReturnOrigin("https://evil.test/?x=https://sovereign.example", configured)).toBe(
      "https://sovereign.example",
    );
  });

  it("accepts the configured origin when the request genuinely carries it", () => {
    expect(resolveReturnOrigin("https://sovereign.example", configured)).toBe("https://sovereign.example");
  });

  it("tolerates a trailing slash on both the configured value and the request", () => {
    const env = { PUBLIC_BASE_URL: "https://sovereign.example/", NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("https://sovereign.example/", env)).toBe("https://sovereign.example");
  });

  it("falls back to the configured origin when the request sends no Origin at all", () => {
    expect(resolveReturnOrigin(undefined, configured)).toBe("https://sovereign.example");
  });

  it("honours PROMOTION_PUBLIC_ORIGIN so a deployment needs only one source of truth", () => {
    const env = { PROMOTION_PUBLIC_ORIGIN: "https://promo.example", NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("https://evil.example", env)).toBe("https://promo.example");
  });

  it("allows a Vercel preview origin, with the same hostname guard as promotion-fix", () => {
    const env = {
      PUBLIC_BASE_URL: "https://sovereign.example",
      VERCEL_ENV: "preview",
      VERCEL_URL: "app-git-branch.vercel.app",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("https://app-git-branch.vercel.app", env)).toBe(
      "https://app-git-branch.vercel.app",
    );
  });

  it("rejects a VERCEL_URL carrying anything outside the hostname charset", () => {
    const env = {
      PUBLIC_BASE_URL: "https://sovereign.example",
      VERCEL_ENV: "preview",
      VERCEL_URL: "evil.test/path",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("https://evil.test/path", env)).toBe("https://sovereign.example");
  });

  it("does not treat VERCEL_URL as trusted outside a preview deployment", () => {
    const env = {
      PUBLIC_BASE_URL: "https://sovereign.example",
      VERCEL_ENV: "production",
      VERCEL_URL: "app.vercel.app",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("https://app.vercel.app", env)).toBe("https://sovereign.example");
  });

  it("fails closed rather than guessing when nothing is configured in production", () => {
    const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(() => resolveReturnOrigin("https://evil.example", env)).toThrow(/return origin is configured/);
  });

  it("still allows localhost for local development", () => {
    const env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    expect(resolveReturnOrigin("http://localhost:3000", env)).toBe("http://localhost:3000");
  });

  /**
   * A configured origin must be a bare origin, not merely a string that ends
   * without a slash. `server/promotion-fix-service.mjs` already refuses anything
   * else with a 503, and this code claims to mirror that allowlist — so an
   * earlier version which only stripped trailing slashes was a weaker control
   * wearing the same name. Each value below would otherwise have become the
   * checkout return origin, with CHECKOUT_SESSION_ID attached.
   */
  describe("rejects a misconfigured origin instead of trusting it", () => {
    const cases: Array<[string, string]> = [
      ["plaintext http", "http://evil.test"],
      ["userinfo", "https://a@evil.test"],
      ["userinfo with password", "https://a:b@evil.test"],
      ["a path", "https://evil.test/checkout"],
      ["a query string", "https://evil.test/?next=x"],
      ["a fragment", "https://evil.test/#x"],
      ["not a URL at all", "evil.test"],
      ["a non-http scheme", "javascript:alert(1)"],
    ];

    for (const [label, value] of cases) {
      it(`${label}: this value is not usable as a return origin`, () => {
        const env = { PUBLIC_BASE_URL: value, NODE_ENV: "production" } as NodeJS.ProcessEnv;
        // Nothing valid remains configured, so it must fail closed rather than
        // fall back to the bad value.
        expect(() => resolveReturnOrigin(undefined, env)).toThrow(/return origin is configured/);
      });
    }

    it("keeps the valid origin when one of the two variables is malformed", () => {
      const env = {
        PUBLIC_BASE_URL: "http://evil.test",
        PROMOTION_PUBLIC_ORIGIN: "https://good.example",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv;
      expect(resolveReturnOrigin("http://evil.test", env)).toBe("https://good.example");
    });

    it("normalises a configured origin with a port through URL parsing", () => {
      const env = {
        PUBLIC_BASE_URL: "https://good.example:8443/",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv;
      expect(resolveReturnOrigin(undefined, env)).toBe("https://good.example:8443");
    });
  });
});
