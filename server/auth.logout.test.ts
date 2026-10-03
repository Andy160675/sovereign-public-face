import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME, HOST_COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // Was one cookie. Sign-out now clears BOTH the `__Host-` prefixed name and
    // the legacy one, so a user still holding a pre-prefix cookie is signed out
    // properly instead of keeping a cookie the server no longer reads. Asserted
    // by name rather than by count, so adding a third name later does not
    // silently pass while leaving one uncleared.
    const clearedNames = clearedCookies.map(c => c.name);
    expect(clearedNames).toContain(HOST_COOKIE_NAME);
    expect(clearedNames).toContain(COOKIE_NAME);

    const hostCookie = clearedCookies.find(c => c.name === HOST_COOKIE_NAME);
    expect(hostCookie?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      // Was "none". That pinned a CSRF exposure as though it were an invariant:
      // `none` makes every cross-site request carry the session cookie, and the
      // tRPC mutations authenticate by cookie. Nothing needed it: a Lax cookie
      // is not sent on a cross-site iframe load at all, and the OAuth return is
      // a top-level GET navigation, which `lax` does send the cookie on. (An
      // earlier version of this comment cited `X-Frame-Options: DENY` on every
      // path, which is false for the Express host that sets this cookie.)
      //
      // The assertion is kept rather than dropped: pinned to the safe value it
      // now fails if the attribute ever regresses to `none`.
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });
});
