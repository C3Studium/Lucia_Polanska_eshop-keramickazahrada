import crypto from "crypto"
import { storefrontBase } from "./storefront-url"

/**
 * Signed links for course reservations — the balance-payment-link pattern.
 *
 * A reservation page has to be reachable from an e-mail and from a ComGate
 * return redirect, and in both cases the visitor carries no session. The token
 * is an HMAC of the reservation id under the server's own secret: unguessable,
 * nothing new to store, and it cannot be moved to another reservation.
 *
 * It deliberately does not expire — a customer opening the confirmation mail a
 * month later should still see their reservation. What the page *shows* is
 * re-read on every visit, so a stale link can never show stale money state.
 */

const secret = (): string => {
  const value = process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (!value) {
    throw new Error(
      "Cannot sign a course reservation link without JWT_SECRET or COOKIE_SECRET."
    )
  }
  return value
}

export const signCourseReservationToken = (reservationId: string): string =>
  crypto
    .createHmac("sha256", secret())
    .update(`course-reservation:${reservationId}`)
    .digest("hex")
    .slice(0, 32)

/** Constant-time compare, so the token cannot be guessed a character at a time. */
export const verifyCourseReservationToken = (
  reservationId: string,
  token: unknown
): boolean => {
  if (typeof token !== "string" || !token.length) {
    return false
  }
  const expected = signCourseReservationToken(reservationId)
  const given = Buffer.from(token)
  const wanted = Buffer.from(expected)

  if (given.length !== wanted.length) {
    return false
  }
  return crypto.timingSafeEqual(given, wanted)
}

/**
 * Storefront path (no origin) of the reservation page —
 * `app/[countryCode]/(main)/kurzy/rezervace/[id]`. The ComGate provider
 * resolves paths against `STOREFRONT_PUBLIC_URL` itself, so the return URLs
 * are built from this and the e-mail links from the absolute variant below.
 */
export const courseReservationPath = (
  reservationId: string,
  outcome?: string
): string => {
  const country = (process.env.STOREFRONT_COUNTRY || "cz").toLowerCase()
  const token = signCourseReservationToken(reservationId)
  const suffix = outcome ? `&vysledek=${outcome}` : ""
  return `/${country}/kurzy/rezervace/${reservationId}?token=${token}${suffix}`
}

/** Absolute reservation link for e-mail buttons, or `""` when unconfigured. */
export const courseReservationLink = (reservationId: string): string => {
  const base = storefrontBase()
  if (!base) {
    return ""
  }
  return `${base}/kurzy/rezervace/${reservationId}?token=${signCourseReservationToken(
    reservationId
  )}`
}
