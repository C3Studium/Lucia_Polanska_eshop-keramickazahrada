import crypto from "crypto"

/**
 * Signed „pay the rest" links for e-mails.
 *
 * An e-mail button is a GET request from a mail client — it cannot carry an
 * auth header, and the customer is not logged in. So the link has to prove on
 * its own that whoever holds it was sent it.
 *
 * The token is an HMAC of the order id under the server's own secret. That
 * gives a link that is unguessable, needs no new column to store, and cannot be
 * transferred to another order: change the id and the signature stops matching.
 *
 * It deliberately does **not** expire. A customer who finds the mail three
 * weeks later should still be able to pay; the underlying payment collection is
 * what decides whether there is anything left to pay, and it is re-checked on
 * every visit.
 */

const secret = (): string => {
  // The same secret the server already trusts for sessions. If it is missing
  // the process would not have booted — `lib/constants` asserts it.
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error(
      "Cannot sign a balance payment link without JWT_SECRET or COOKIE_SECRET."
    )
  }
  return value
}

export const signBalanceToken = (orderId: string): string =>
  crypto
    .createHmac("sha256", secret())
    .update(`balance:${orderId}`)
    .digest("hex")
    .slice(0, 32)

/** Constant-time compare, so the token cannot be guessed a character at a time. */
export const verifyBalanceToken = (
  orderId: string,
  token: unknown
): boolean => {
  if (typeof token !== "string" || !token.length) {
    return false
  }
  const expected = signBalanceToken(orderId)
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)

  if (given.length !== wanted.length) {
    return false
  }
  return crypto.timingSafeEqual(given, wanted)
}

/**
 * The absolute URL that belongs in an e-mail button.
 *
 * Points at the backend rather than the storefront on purpose: the backend is
 * what can create the payment session, and routing it through a storefront page
 * would mean the button is broken until that page exists.
 *
 * Top-level path, not `/store/...`: the store namespace demands a publishable
 * API key on every request and a click from a mail client sends no headers,
 * so the store variant of this route can never open from an e-mail. The
 * top-level alias (`src/api/made-to-order/.../pay-balance`) has no such guard.
 */
export const balancePaymentUrl = (
  orderId: string,
  /**
   * Zakázka, jejíž doplatek odkaz platí (od 20. 10. 2026 má objednávka zakázek
   * víc, každá vlastní doplatek). Bez ní routa vezme jedinou zakázku s
   * otevřeným doplatkem — staré odkazy v e-mailech tak dál fungují.
   */
  productionOrderId?: string | null,
  /** "deposit" = jen záloha (cena po domluvě), jinak celý dluh. */
  part?: "full" | "deposit"
): string | null => {
  const base = (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    ""
  ).replace(/\/+$/, "")

  if (!base) {
    return null
  }

  return `${base}/made-to-order/${orderId}/pay-balance${balancePaymentQuery(orderId, productionOrderId)}${
    part === "deposit" ? "&castka=zaloha" : ""
  }`
}

/** `?token=…[&production_order_id=…]` — sdílené s fallbackem na host requestu v routě `balance`. */
export const balancePaymentQuery = (
  orderId: string,
  productionOrderId?: string | null
): string =>
  `?token=${signBalanceToken(orderId)}${
    productionOrderId ? `&production_order_id=${encodeURIComponent(productionOrderId)}` : ""
  }`
