export const COOKIE_NAME = "app_session_id";
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
