import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, HOST_COOKIE_NAME } from "../shared/const";
import {
  getSessionCookie,
  sessionCookieNamesToClear,
  usesHostPrefix,
} from "./_core/cookies";
import type { Request } from "express";

/**
 * The attack these tests encode — cookie tossing from a sibling host.
 *
 * The deployment is a leaf of a shared parent domain (`*.manus.space`). With an
 * unprefixed cookie, any sibling host could send
 * `Set-Cookie: app_session_id=<its own valid token>; Domain=.manus.space`. The
 * browser then presents BOTH cookies, and the `cookie` parser keeps the first
 * value it sees, so the sibling's token wins. It verifies legitimately — it is a
 * real token for this app — so the victim browses as the attacker and can pay
 * into the attacker's Stripe record.
 *
 * `Secure` and `sameSite` are no defence: the attacker is not making a
 * cross-site request, they are planting a cookie from a sibling origin. The
 * `__Host-` prefix is the control, because a browser refuses any `__Host-`
 * cookie carrying a `Domain` attribute.
 */

function fakeRequest(opts: { https?: boolean; hostname?: string } = {}): Request {
  return {
    protocol: opts.https === false ? "http" : "https",
    hostname: opts.hostname ?? "sovereigna-sjdwyspm.manus.space",
    headers: {},
  } as unknown as Request;
}

const original = process.env.NODE_ENV;
beforeEach(() => {
  process.env.NODE_ENV = "production";
});
afterEach(() => {
  process.env.NODE_ENV = original;
});

describe("the planted sibling cookie is the thing being defended against", () => {
  it("reproduces why the unprefixed name was exploitable: first value wins", () => {
    // Exactly what the browser would send with both cookies present.
    const parsed = parseCookieHeader(
      `${COOKIE_NAME}=ATTACKER_TOKEN; ${COOKIE_NAME}=VICTIM_TOKEN`,
    );
    expect(parsed[COOKIE_NAME]).toBe("ATTACKER_TOKEN");
  });

  it("a __Host- cookie cannot be planted with a Domain, which is what closes it", () => {
    // Not a browser test — it records the invariant the prefix buys, so the
    // reason this name was chosen stays with the code.
    const { name, options } = getSessionCookie(fakeRequest());
    expect(name).toBe(HOST_COOKIE_NAME);
    expect(name.startsWith("__Host-")).toBe(true);
    expect(options.domain).toBeUndefined();
  });
});

describe("production always satisfies every __Host- condition", () => {
  it("uses the prefixed name", () => {
    expect(getSessionCookie(fakeRequest()).name).toBe(HOST_COOKIE_NAME);
  });

  it("is Secure, Path=/ and carries no Domain", () => {
    const { options } = getSessionCookie(fakeRequest());
    expect(options.secure).toBe(true);
    expect(options.path).toBe("/");
    expect(options.domain).toBeUndefined();
  });

  it("stays Secure even when the request looks like plain http", () => {
    // A browser silently DISCARDS a __Host- cookie that is not Secure, so a
    // mis-read proxy header must not be able to produce that pairing.
    const { name, options } = getSessionCookie(fakeRequest({ https: false }));
    expect(name).toBe(HOST_COOKIE_NAME);
    expect(options.secure).toBe(true);
  });

  it("stays Secure and prefixed even for a localhost-shaped hostname", () => {
    const { name, options } = getSessionCookie(
      fakeRequest({ https: false, hostname: "localhost" }),
    );
    expect(name).toBe(HOST_COOKIE_NAME);
    expect(options.secure).toBe(true);
  });

  it("keeps sameSite lax, which __Host- permits and sign-in needs", () => {
    expect(getSessionCookie(fakeRequest()).options.sameSite).toBe("lax");
  });

  it("never pairs a prefixed name with a non-Secure cookie, across many shapes", () => {
    const shapes = [
      fakeRequest(),
      fakeRequest({ https: false }),
      fakeRequest({ hostname: "localhost" }),
      fakeRequest({ https: false, hostname: "127.0.0.1" }),
      fakeRequest({ https: false, hostname: "" }),
    ];
    for (const req of shapes) {
      const { name, options } = getSessionCookie(req);
      if (name.startsWith("__Host-")) {
        expect(options.secure, `prefixed but not Secure for ${req.hostname}`).toBe(true);
        expect(options.path).toBe("/");
        expect(options.domain).toBeUndefined();
      }
    }
  });
});

describe("local development still works", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  it("falls back to the unprefixed name on plain-http localhost", () => {
    // A __Host- cookie needs Secure, which plain http cannot provide, so the
    // developer would simply never stay signed in.
    const { name, options } = getSessionCookie(
      fakeRequest({ https: false, hostname: "localhost" }),
    );
    expect(name).toBe(COOKIE_NAME);
    expect(options.secure).toBe(false);
  });

  it("uses the prefixed name as soon as the request is genuinely https", () => {
    const { name, options } = getSessionCookie(fakeRequest({ hostname: "localhost" }));
    expect(name).toBe(HOST_COOKIE_NAME);
    expect(options.secure).toBe(true);
  });

  it("usesHostPrefix tracks the request, not the hostname", () => {
    expect(usesHostPrefix(fakeRequest({ https: false, hostname: "localhost" }))).toBe(false);
    expect(usesHostPrefix(fakeRequest({ hostname: "localhost" }))).toBe(true);
  });
});

describe("sign-out clears the legacy cookie too", () => {
  it("clears both names in production, so a pre-prefix session is not stranded", () => {
    const names = sessionCookieNamesToClear(fakeRequest());
    expect(names).toContain(HOST_COOKIE_NAME);
    expect(names).toContain(COOKIE_NAME);
  });

  it("clears only the unprefixed name when that is the one in use", () => {
    process.env.NODE_ENV = "development";
    expect(sessionCookieNamesToClear(fakeRequest({ https: false, hostname: "localhost" }))).toEqual([
      COOKIE_NAME,
    ]);
  });
});
