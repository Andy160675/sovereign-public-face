import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  // In production the cookie is always Secure. Deriving it only from the request
  // meant that any deployment where `x-forwarded-proto` was absent or rewritten
  // served the session cookie over plaintext.
  const isLocal = LOCAL_HOSTS.has(req.hostname) || isIpAddress(req.hostname ?? "");
  const secure =
    process.env.NODE_ENV === "production" ? true : isSecureRequest(req) || !isLocal;

  return {
    httpOnly: true,
    path: "/",
    // `none` let every cross-site request carry the session cookie, which is the
    // precondition for CSRF against the cookie-authenticated tRPC mutations.
    //
    // `lax` is correct here, and nothing is given up:
    //   · every path already sends `X-Frame-Options: DENY`, so there is no
    //     cross-site embedding that needed `none`;
    //   · the OAuth return is `res.redirect(302, "/")` — a top-level GET
    //     navigation, which `lax` does send the cookie on, so sign-in completes;
    //   · the SPA's own tRPC calls are same-origin, so they are unaffected.
    //
    // `none` also *requires* `Secure`, so whenever the proxy headers read as
    // http the browser dropped the cookie outright. `lax` removes that
    // silent-logout failure mode too.
    sameSite: "lax",
    secure,
  };
}
