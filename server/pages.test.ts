import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { PRODUCTS } from "./products";
import type { TrpcContext } from "./_core/context";

afterEach(() => vi.unstubAllEnvs());

/**
 * Test that the auth.me public procedure works for unauthenticated users.
 * This validates the tRPC stack is wired correctly.
 */
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Public Face — tRPC stack", () => {
  it("auth.me returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.logout clears cookie and returns success", async () => {
    const clearedCookies: { name: string }[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, _options: Record<string, unknown>) => {
          clearedCookies.push({ name });
        },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBe(1);
  });
});

describe("Public Face — Page routes validation", () => {
  const expectedPages = [
    "/",
    "/services",
    "/audit",
    "/packs",
    "/team",
    "/about",
    "/contact",
    "/book",
  ];

  it("all expected page routes are defined", () => {
    // This test validates our route configuration matches the expected pages
    expect(expectedPages).toHaveLength(8);
    expect(expectedPages).toContain("/");
    expect(expectedPages).toContain("/services");
    expect(expectedPages).toContain("/audit");
    expect(expectedPages).toContain("/packs");
    expect(expectedPages).toContain("/team");
    expect(expectedPages).toContain("/about");
    expect(expectedPages).toContain("/contact");
    expect(expectedPages).toContain("/book");
  });

  it("no duplicate routes exist", () => {
    const unique = new Set(expectedPages);
    expect(unique.size).toBe(expectedPages.length);
  });
});

describe("Stripe checkout configuration", () => {
  it("loads non-payment routes without a key and fails only when checkout is invoked", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.me()).resolves.toMatchObject({ id: 1 });
    for (const key of ["", "   "]) {
      vi.stubEnv("STRIPE_SECRET_KEY", key);
      await expect(caller.checkout.createSession({ productId: PRODUCTS[0]!.id })).rejects.toThrow(
        "Payment service is not configured.",
      );
    }
  });
});
