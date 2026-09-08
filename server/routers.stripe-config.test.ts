import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

afterEach(() => {
  if (originalStripeSecretKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
  }
  vi.resetModules();
});

describe("Stripe configuration isolation", () => {
  it("keeps public routes usable when STRIPE_SECRET_KEY is absent", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createContext());

    await expect(caller.auth.me()).resolves.toBeNull();
    await expect(caller.products.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ai-compliance-audit" }),
      ])
    );
  });

  it("fails closed before checkout when STRIPE_SECRET_KEY is absent", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "test",
        role: "user",
        createdAt: new Date("2026-09-07T00:00:00.000Z"),
        updatedAt: new Date("2026-09-07T00:00:00.000Z"),
        lastSignedIn: new Date("2026-09-07T00:00:00.000Z"),
      })
    );

    await expect(
      caller.checkout.createSession({ productId: "ai-compliance-audit" })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Checkout is temporarily unavailable.",
    });
  });
});
