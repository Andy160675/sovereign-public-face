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
  vi.stubEnv("STRIPE_SECRET_KEY", undefined);
  createSession.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkout configuration boundary", () => {
  it("serves public authentication and product queries without a Stripe key", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(context(false));

    expect(await caller.auth.me()).toBeNull();
    expect(await caller.products.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ai-governance-checklist", price: 1900 }),
      ])
    );
    expect(
      await caller.products.byId({ id: "ai-governance-checklist" })
    ).toMatchObject({
      id: "ai-governance-checklist",
      price: 1900,
      currency: "gbp",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("fails closed with a configuration error when authenticated checkout has no key", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(context());

    await expect(
      caller.checkout.createSession({ productId: "ai-governance-checklist" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Checkout is not configured",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("still requires authentication before attempting checkout", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(context(false));

    await expect(
      caller.checkout.createSession({ productId: "ai-governance-checklist" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects unknown products without attempting checkout", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(context());

    await expect(
      caller.checkout.createSession({ productId: "missing-product" })
    ).rejects.toThrow("Product not found: missing-product");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("reads configuration at checkout time and preserves the payment request", async () => {
    const { appRouter } = await import("./routers");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_checkout_local_fixture");
    createSession.mockResolvedValue({
      url: "https://checkout.example.test/session",
    });
    const caller = appRouter.createCaller(context());

    await expect(
      caller.checkout.createSession({ productId: "ai-governance-checklist" })
    ).resolves.toEqual({ url: "https://checkout.example.test/session" });
    expect(createSession).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith({
      mode: "payment",
      customer_email: "checkout@example.test",
      client_reference_id: "7",
      metadata: {
        user_id: "7",
        customer_email: "checkout@example.test",
        customer_name: "Checkout Test",
        product_id: "ai-governance-checklist",
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "AI Governance Checklist for SMBs",
              description: expect.any(String),
            },
            unit_amount: 1900,
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url:
        "https://shop.example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://shop.example.test/checkout/cancel",
    });
  });

  it("preserves monthly subscription checkout", async () => {
    const { appRouter } = await import("./routers");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_checkout_local_fixture");
    createSession.mockResolvedValue({
      url: "https://checkout.example.test/subscription",
    });
    const caller = appRouter.createCaller(context());

    await expect(
      caller.checkout.createSession({ productId: "managed-fleet" })
    ).resolves.toEqual({ url: "https://checkout.example.test/subscription" });
    expect(createSession).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        metadata: expect.objectContaining({ product_id: "managed-fleet" }),
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: expect.any(Object),
              unit_amount: 200000,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
      })
    );
  });
});
