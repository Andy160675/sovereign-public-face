import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { createSession } = vi.hoisted(() => ({ createSession: vi.fn() }));

// Keep the real SDK constructor and its configuration checks. Only replace the
// network boundary; these tests must never send a request to Stripe.
vi.mock("stripe", async importOriginal => {
  const actual = await importOriginal<typeof import("stripe")>();
  return {
    ...actual,
    default: class extends actual.default {
      constructor(...args: ConstructorParameters<typeof actual.default>) {
        super(...args);
        this.checkout.sessions.create = createSession;
      }
    },
  };
});

function context(authenticated = true): TrpcContext {
  return {
    user: authenticated
      ? {
          id: 7,
          openId: "checkout-test",
          email: "checkout@example.test",
          name: "Checkout Test",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          lastSignedIn: new Date("2026-01-01T00:00:00Z"),
        }
      : null,
    req: {
      protocol: "https",
      headers: { origin: "https://shop.example.test" },
    } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_BASE_URL", "https://shop.example.test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_checkout_local_fixture");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PROMOTION_PUBLIC_ORIGIN", undefined);
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("VERCEL_URL", undefined);
  createSession.mockReset();
  createSession.mockResolvedValue({ url: "https://checkout.example.test/session" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkout return origin boundary", () => {
  for (const headers of [
    { origin: "https://evil.example", referer: "https://evil.example/paid" },
    { referer: "https://evil.example/paid" },
  ]) {
    it(`uses configured URLs for untrusted headers ${JSON.stringify(headers)}`, async () => {
      const { appRouter } = await import("./routers");
      const ctx = context();
      ctx.req.headers = headers;
      await appRouter.createCaller(ctx).checkout.createSession({ productId: "ai-governance-checklist" });
      expect(createSession).toHaveBeenCalledOnce();
      expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
        success_url: "https://shop.example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://shop.example.test/checkout/cancel",
      }));
    });
  }
  it("fails closed without a configured production origin before sending to Stripe", async () => {
    vi.stubEnv("PUBLIC_BASE_URL", undefined);
    const { appRouter } = await import("./routers");
    await expect(appRouter.createCaller(context()).checkout.createSession({ productId: "ai-governance-checklist" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Checkout is not configured" });
    expect(createSession).not.toHaveBeenCalled();
  });
});
