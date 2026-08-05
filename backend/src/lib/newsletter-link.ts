import crypto from "crypto"

/**
 * Signed unsubscribe links for newsletter e-mails.
 *
 * The unsubscribe link in an e-mail footer is a GET from a mail client — no
 * auth header, no publishable key, no session. So the link has to prove on its
 * own that whoever holds it was sent it: the token is an HMAC of the address
 * under the server's own secret (mirrors `lib/balance-payment-link.ts`).
 *
 * It deliberately does **not** expire. Someone cleaning their inbox out three
 * months later must still be able to unsubscribe — an expired unsubscribe link
 * is a GDPR complaint waiting to happen.
 */

/** One canonical form of an address, so the token and the DB row always agree. */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase()

const secret = (): string => {
  // The same secret the server already trusts for sessions. If it is missing
  // the process would not have booted — `lib/constants` asserts it.
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error(
      "Cannot sign a newsletter unsubscribe link without JWT_SECRET or COOKIE_SECRET."
    )
  }
  return value
}

export const signUnsubscribeToken = (email: string): string =>
  crypto
    .createHmac("sha256", secret())
    .update(`newsletter-unsubscribe:${normalizeEmail(email)}`)
    .digest("hex")
    .slice(0, 32)

/** Constant-time compare, so the token cannot be guessed a character at a time. */
export const verifyUnsubscribeToken = (
  email: string,
  token: unknown
): boolean => {
  if (typeof token !== "string" || !token.length) {
    return false
  }
  const expected = signUnsubscribeToken(email)
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)

  if (given.length !== wanted.length) {
    return false
  }
  return crypto.timingSafeEqual(given, wanted)
}

/**
 * The absolute URL that belongs in an e-mail footer.
 *
 * Points at the backend rather than the storefront on purpose: the backend is
 * what flips the subscription off, and routing through a storefront page would
 * mean the link is broken until that page exists. The path is a *top-level*
 * route (`/newsletter/unsubscribe`, like `/key-exchange`), not `/store/...`:
 * Medusa applies the publishable-key check to the whole `/store` namespace
 * with no per-route exemption, and a mail client sends no headers at all.
 */
export const newsletterUnsubscribeUrl = (email: string): string | null => {
  const base = (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    ""
  ).replace(/\/+$/, "")

  if (!base) {
    return null
  }

  const normalized = normalizeEmail(email)
  return `${base}/newsletter/unsubscribe?email=${encodeURIComponent(
    normalized
  )}&token=${signUnsubscribeToken(normalized)}`
}
