import crypto from "crypto"

/**
 * Signed links for newsletter e-mails: unsubscribe and opt-in confirmation.
 *
 * Both links are a GET from a mail client — no auth header, no publishable
 * key, no session. So each link has to prove on its own that whoever holds it
 * was sent it: the token is an HMAC of the address under the server's own
 * secret (mirrors `lib/balance-payment-link.ts`). The two purposes sign under
 * different labels, so a confirm token can never be replayed as an
 * unsubscribe token or vice versa.
 *
 * Neither token expires, deliberately. Someone cleaning their inbox out three
 * months later must still be able to unsubscribe — an expired unsubscribe
 * link is a GDPR complaint waiting to happen. And a confirm link that died
 * after a day would mean a lost subscriber who did everything right.
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
      "Cannot sign a newsletter link without JWT_SECRET or COOKIE_SECRET."
    )
  }
  return value
}

const signToken = (purpose: string, email: string): string =>
  crypto
    .createHmac("sha256", secret())
    .update(`${purpose}:${normalizeEmail(email)}`)
    .digest("hex")
    .slice(0, 32)

/** Constant-time compare, so a token cannot be guessed a character at a time. */
const verifyToken = (expected: string, token: unknown): boolean => {
  if (typeof token !== "string" || !token.length) {
    return false
  }
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)

  if (given.length !== wanted.length) {
    return false
  }
  return crypto.timingSafeEqual(given, wanted)
}

export const signUnsubscribeToken = (email: string): string =>
  signToken("newsletter-unsubscribe", email)

export const verifyUnsubscribeToken = (
  email: string,
  token: unknown
): boolean => verifyToken(signUnsubscribeToken(email), token)

export const signConfirmToken = (email: string): string =>
  signToken("newsletter-confirm", email)

export const verifyConfirmToken = (email: string, token: unknown): boolean =>
  verifyToken(signConfirmToken(email), token)

/**
 * Where the backend lives, as seen from a mail client. `""` when
 * unconfigured — callers must treat that as "do not send a dead link".
 */
const backendBase = (): string =>
  (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    ""
  ).replace(/\/+$/, "")

const signedLink = (
  path: string,
  email: string,
  sign: (email: string) => string
): string | null => {
  const base = backendBase()
  if (!base) {
    // Checked before signing on purpose: an unconfigured base must yield
    // `null`, not a thrown "no secret" from an environment that has neither.
    return null
  }
  const normalized = normalizeEmail(email)
  return `${base}${path}?email=${encodeURIComponent(normalized)}&token=${sign(
    normalized
  )}`
}

/**
 * The absolute unsubscribe URL that belongs in an e-mail footer.
 *
 * Points at the backend rather than the storefront on purpose: the backend is
 * what flips the subscription off, and routing through a storefront page would
 * mean the link is broken until that page exists. The path is a *top-level*
 * route (`/newsletter/unsubscribe`, like `/key-exchange`), not `/store/...`:
 * Medusa applies the publishable-key check to the whole `/store` namespace
 * with no per-route exemption, and a mail client sends no headers at all.
 */
export const newsletterUnsubscribeUrl = (email: string): string | null =>
  signedLink("/newsletter/unsubscribe", email, signUnsubscribeToken)

/**
 * The absolute double-opt-in confirmation URL for the signup e-mail.
 * Same shape and reasoning as the unsubscribe link; the handler at
 * `GET /newsletter/confirm` sets `confirmed_at` and bounces to the
 * storefront's landing page.
 */
export const newsletterConfirmUrl = (email: string): string | null =>
  signedLink("/newsletter/confirm", email, signConfirmToken)
