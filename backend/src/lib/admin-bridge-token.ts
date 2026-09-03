import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * The handover token behind „Otevřít web jako admin".
 *
 * ## Why a token and not the admin's own cookie
 *
 * Medusa pins the admin session cookie to `SameSite=lax` in production and
 * does so deliberately — `express-loader.js` carries a comment naming the CSRF
 * advisory (GHSA-jhvc-qx3m-6r3q) that `SameSite=none` caused. The storefront
 * sits on its own Railway domain, so it is cross-site: the browser will never
 * attach `connect.sid` to a request the storefront makes, and relaxing that
 * flag to make it would re-open the exact hole Medusa closed.
 *
 * So the session is never shared. Instead the admin — who is already
 * authenticated on the backend — asks for a short signed statement („this
 * person was an admin at this moment"), carries it across in a URL once, and
 * the storefront exchanges it for a **first-party cookie of its own**. Nothing
 * cross-site is ever read; each side only ever trusts its own cookie.
 *
 * ## SOURCE-OF-TRUTH TWIN
 *
 * `storefront/src/lib/util/admin-bridge-token.ts` is the mirror — the
 * storefront cannot import across projects, the same arrangement
 * `admin/lib/course-calendar.ts` and the e-mail identity constants use. The
 * two files must agree byte for byte on the wire format, so change this one
 * first and copy it over; `__tests__/admin-bridge-token.unit.spec.ts` pins the
 * format on this side.
 *
 * ## The format
 *
 * `base64url(payloadJson).base64url(hmacSha256(payloadJson, secret))` — a
 * minimal JWS, deliberately hand-rolled so the storefront needs no new
 * dependency. Signed, not encrypted: the payload is readable, which is fine
 * because it says nothing secret. What it cannot be is *forged*.
 */

export type AdminBridgeClaims = {
  /** Who it was — shown in the bar so a shared browser is not a mystery. */
  email: string
  /** Seconds since epoch. Past this the storefront refuses the token. */
  exp: number
}

/** Seven days, the window the owner asked for. */
export const ADMIN_BRIDGE_TTL_SECONDS = 7 * 24 * 60 * 60

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const fromBase64url = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const signature = (payload: string, secret: string): string =>
  base64url(createHmac("sha256", secret).update(payload).digest())

export const signAdminBridgeToken = (
  claims: AdminBridgeClaims,
  secret: string
): string => {
  const payload = base64url(JSON.stringify(claims))
  return `${payload}.${signature(payload, secret)}`
}

/**
 * The claims, or null for anything that is not a currently-valid token.
 *
 * Never throws and never explains which check failed: a caller that could
 * tell „bad signature" from „expired" is a caller an attacker can use to
 * probe. `now` is injected so the expiry boundary is testable.
 */
export const verifyAdminBridgeToken = (
  token: string | undefined | null,
  secret: string,
  now: Date = new Date()
): AdminBridgeClaims | null => {
  if (!token || !secret) {
    return null
  }
  const parts = String(token).split(".")
  if (parts.length !== 2) {
    return null
  }
  const [payload, provided] = parts

  const expected = signature(payload, secret)
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  // Length must match before timingSafeEqual, which throws on a mismatch —
  // and the comparison itself stays constant-time so the signature cannot be
  // guessed a byte at a time.
  if (providedBuffer.length !== expectedBuffer.length) {
    return null
  }
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null
  }

  try {
    const claims = JSON.parse(fromBase64url(payload).toString("utf8"))
    if (
      !claims ||
      typeof claims.email !== "string" ||
      typeof claims.exp !== "number"
    ) {
      return null
    }
    if (claims.exp * 1000 <= now.getTime()) {
      return null
    }
    return { email: claims.email, exp: claims.exp }
  } catch {
    return null
  }
}
