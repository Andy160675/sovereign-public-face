/**
 * Legacy session cookie name. Still written in local development over plain
 * http, where a `__Host-` cookie cannot be set, and accepted on read ONLY
 * outside production — see `HOST_COOKIE_NAME`.
 */
export const COOKIE_NAME = "app_session_id";

/**
 * The session cookie in production.
 *
 * The `__Host-` prefix is not decoration: a browser refuses to store such a
 * cookie unless it is `Secure`, has `Path=/`, and carries NO `Domain`
 * attribute. That last condition is the one that matters here.
 *
 * The deployment is a leaf of a shared parent domain (`*.manus.space`). Without
 * the prefix, any sibling host could send
 * `Set-Cookie: app_session_id=<its own valid token>; Domain=.manus.space`, and
 * the browser would then present BOTH cookies on every request. The `cookie`
 * parser keeps the first value it sees ("only assign once"), so the sibling's
 * token wins. It verifies legitimately — it is a real token for this app — so
 * the victim browses as the attacker, and `checkout.createSession` writes the
 * attacker into `client_reference_id` and `customer_email`. The victim can pay
 * into the attacker's record.
 *
 * `sameSite` and `Secure` do not help: the attacker is not making a cross-site
 * request, they are planting a cookie from a sibling origin. The prefix is the
 * control, because browsers reject any `__Host-` cookie that carries `Domain`.
 *
 * There is deliberately NO production fallback to the unprefixed name. A
 * fallback would preserve the attack for anyone not currently signed in — the
 * forced-login half of it — which is most of the value an attacker wants.
 * Removing it invalidates existing sessions once; that is the cost of closing
 * it, and it is paid once.
 */
export const HOST_COOKIE_NAME = "__Host-app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

/**
 * How long a signed-in session stays valid.
 *
 * Sign-in used to mint the session token AND set its cookie with `ONE_YEAR_MS`,
 * so a stolen cookie stayed usable for a year, and a shared or lost device kept
 * the account signed in for a year. Shortening that exposure window is the
 * point; 30 days is long enough that ordinary users are not re-authenticating
 * noticeably often.
 *
 * Deliberately separate from `ONE_YEAR_MS`, which is also the SDK's generic
 * default for things that are not sessions.
 *
 * This is a product trade-off as well as a security one: raise it if 30 days
 * proves too short, but a year is not a sensible session length for an account
 * that can start a payment.
 */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
