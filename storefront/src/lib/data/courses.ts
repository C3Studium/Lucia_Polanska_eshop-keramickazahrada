"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

/**
 * Server actions for the course reservation system (docs/kurzy-system.md).
 *
 * Everything money-related is computed by the backend: the terms list carries
 * the pricing rules for *display*, `quoteCourseTerm` is the live price the
 * form shows, and the create recomputes the total once more inside a row
 * lock. Nothing here ever sends a price to the server.
 */

export type CourseTerm = {
  id: string
  title: string
  location: string
  starts_at: string
  duration_minutes: number | null
  capacity: number
  seats_taken: number
  seats_left: number
  sold_out: boolean
  price_single: number
  price_two: number | null
  group_min: number | null
  price_group_per_person: number | null
}

export type CourseQuote = {
  term_id: string
  party_size: number
  tier: "single" | "pair" | "group"
  per_person: number
  total: number
  seats_left: number
}

export type CourseReservationInput = {
  term_id: string
  name: string
  email: string
  phone: string
  party_size: number
  payment_method: "online" | "on_site"
  /** Honeypot — forwarded verbatim, humans never fill it. */
  website?: string
}

export type CourseReservationResult =
  | {
      ok: true
      reservation_id: string
      token: string
      payment_url?: string
    }
  | { ok: false; message: string }

export type CourseReservationDetail = {
  id: string
  name: string
  party_size: number
  pricing_tier: "single" | "pair" | "group"
  total_price: number
  payment_method: "online" | "on_site"
  payment_status: "pending" | "paid" | "on_site"
  status: "active" | "cancelled"
  /** Why a cancelled reservation was cancelled — self-cancels read differently. */
  cancel_reason: "auto_expired" | "manual" | "term_cancelled" | "customer" | null
  /** Stamped once the automatic ComGate refund ran. */
  refunded_at: string | null
  invoice_pdf_url: string | null
  term: {
    id: string
    title: string
    location: string
    starts_at: string
    duration_minutes: number | null
    status: string
  }
}

export type MyCourseReservation = {
  id: string
  party_size: number
  pricing_tier: "single" | "pair" | "group"
  total_price: number
  payment_method: "online" | "on_site"
  payment_status: "pending" | "paid" | "on_site"
  status: "active" | "cancelled"
  created_at: string
  invoice_pdf_url: string | null
  token: string
  term: {
    id: string
    title: string
    location: string
    starts_at: string
    duration_minutes: number | null
    status: string
  }
}

/**
 * Backend errors carry Czech, customer-ready messages; transport failures
 * carry English internals. Show the former, replace the latter.
 */
const readableMessage = (error: unknown, fallback: string): string => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "").trim()
      : ""
  const looksInternal =
    !message ||
    message.length < 4 ||
    /internal|unauthorized|forbidden|not allowed|fetch|network|unexpected|error/i.test(
      message
    )
  return looksInternal ? fallback : message
}

/** Published upcoming terms — the reservation section's list. */
export const listCourseTerms = async (): Promise<CourseTerm[]> =>
  sdk.client
    .fetch<{ terms: CourseTerm[] }>(`/store/courses/terms`, {
      cache: "no-store",
    })
    .then(({ terms }) => terms ?? [])
    .catch(() => [])

/** The server's price for `partySize` people — display only. */
export const quoteCourseTerm = async (
  termId: string,
  partySize: number
): Promise<CourseQuote | null> =>
  sdk.client
    .fetch<CourseQuote>(
      `/store/courses/terms/${termId}/quote?party_size=${partySize}`,
      { cache: "no-store" }
    )
    .catch(() => null)

/**
 * Creates the reservation. Runs on the server so the logged-in customer's
 * token travels along and the backend can link the booking to the account.
 */
export const createCourseReservation = async (
  input: CourseReservationInput
): Promise<CourseReservationResult> => {
  const headers = await getAuthHeaders()
  try {
    const result = await sdk.client.fetch<{
      reservation_id: string
      token: string
      payment_url?: string
    }>(`/store/courses/reservations`, {
      method: "POST",
      headers,
      body: input,
      cache: "no-store",
    })
    return { ok: true, ...result }
  } catch (error) {
    return {
      ok: false,
      message: readableMessage(
        error,
        "Rezervaci se nepodařilo odeslat. Zkuste to prosím znovu."
      ),
    }
  }
}

export type CourseWaitlistInput = {
  term_id: string
  name: string
  email: string
  party_size: number
  /** Honeypot — forwarded verbatim, humans never fill it. */
  website?: string
}

export type CourseWaitlistResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Joins the waitlist of a full term. The backend refuses terms with room
 * („Termín má volno — rezervujte rovnou.") and quietly deduplicates repeated
 * signups for the same e-mail and term — the form can just show success.
 */
export const joinCourseWaitlist = async (
  input: CourseWaitlistInput
): Promise<CourseWaitlistResult> => {
  try {
    await sdk.client.fetch<{ ok: boolean }>(`/store/courses/waitlist`, {
      method: "POST",
      body: input,
      cache: "no-store",
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: readableMessage(
        error,
        "Zápis se nepodařilo odeslat. Zkuste to prosím znovu."
      ),
    }
  }
}

/** One reservation, for the holder of its signed link (return page, e-mail). */
export const getCourseReservation = async (
  reservationId: string,
  token: string
): Promise<CourseReservationDetail | null> =>
  sdk.client
    .fetch<{ reservation: CourseReservationDetail }>(
      `/store/courses/reservations/${reservationId}?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
    .then(({ reservation }) => reservation ?? null)
    .catch(() => null)

/** A fresh (or still-valid) ComGate link after an abandoned payment. */
export const retryCoursePayment = async (
  reservationId: string,
  token: string
): Promise<{ payment_url?: string; message?: string }> =>
  sdk.client
    .fetch<{ payment_url: string }>(
      `/store/courses/reservations/${reservationId}/pay?token=${encodeURIComponent(token)}`,
      { method: "POST", cache: "no-store" }
    )
    .catch((error: unknown) => ({
      message: readableMessage(
        error,
        "Platbu se teď nepodařilo založit. Zkuste to prosím za chvíli."
      ),
    }))

export type CancelCourseReservationResult =
  | { ok: true; refunded: boolean; needs_manual_refund: boolean }
  | { ok: false; message: string }

/**
 * The customer cancels their own reservation. Auth is the signed token; a
 * logged-in customer's session travels along too, so the backend accepts
 * either proof. The backend enforces the 48h cutoff, frees the seats, runs
 * the automatic refund for online-paid bookings and sends the e-mails — the
 * UI only relays its Czech answer.
 */
export const cancelCourseReservation = async (
  reservationId: string,
  token: string
): Promise<CancelCourseReservationResult> => {
  const headers = await getAuthHeaders()
  try {
    const result = await sdk.client.fetch<{
      refunded: boolean
      needs_manual_refund: boolean
    }>(
      `/store/courses/reservations/${reservationId}/cancel?token=${encodeURIComponent(token)}`,
      { method: "POST", headers, cache: "no-store" }
    )
    return {
      ok: true,
      refunded: Boolean(result.refunded),
      needs_manual_refund: Boolean(result.needs_manual_refund),
    }
  } catch (error) {
    return {
      ok: false,
      message: readableMessage(
        error,
        "Rezervaci se teď nepodařilo zrušit. Zkuste to prosím znovu."
      ),
    }
  }
}

export type EditCourseReservationResult =
  | {
      ok: true
      party_size: number
      pricing_tier: "single" | "pair" | "group"
      total_price: number
    }
  | { ok: false; message: string }

/**
 * The customer changes their party size (same auth as the cancel). Allowed
 * only before the 48h cutoff and while nothing was paid online; capacity and
 * the new price are settled server-side under the term's row lock.
 */
export const editCourseReservation = async (
  reservationId: string,
  token: string,
  partySize: number
): Promise<EditCourseReservationResult> => {
  const headers = await getAuthHeaders()
  try {
    const result = await sdk.client.fetch<{
      reservation: {
        party_size: number
        pricing_tier: "single" | "pair" | "group"
        total_price: number
      }
    }>(
      `/store/courses/reservations/${reservationId}/edit?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers,
        body: { party_size: partySize },
        cache: "no-store",
      }
    )
    return {
      ok: true,
      party_size: result.reservation.party_size,
      pricing_tier: result.reservation.pricing_tier,
      total_price: result.reservation.total_price,
    }
  } catch (error) {
    return {
      ok: false,
      message: readableMessage(
        error,
        "Změnu se teď nepodařilo uložit. Zkuste to prosím znovu."
      ),
    }
  }
}

/** The logged-in customer's reservations — the account dashboard page. */
export const listMyCourseReservations = async (): Promise<
  MyCourseReservation[]
> => {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) {
    return []
  }
  return sdk.client
    .fetch<{ reservations: MyCourseReservation[] }>(
      `/store/customers/me/course-reservations`,
      { headers, cache: "no-store" }
    )
    .then(({ reservations }) => reservations ?? [])
    .catch(() => [])
}
