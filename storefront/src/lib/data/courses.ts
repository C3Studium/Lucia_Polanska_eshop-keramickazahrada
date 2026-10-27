"use server"

import { sdk } from "@lib/config"
import { inlineToPlain } from "@lib/legal/inline"
import { getAuthHeaders } from "./cookies"
import { getLegalFacts } from "./legal-facts"
import { getPublishedLegalRegistry } from "./legal-registry"

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
  /** Souhlas s OP (čl. Kurzy) — povinný, backend bez něj rezervaci odmítne. */
  terms_accepted: boolean
  /** Poučení o výjimce z odstoupení (§ 1837 písm. j) OZ) bylo v okně nad tlačítkem — okno posílá vždy `true`. */
  exception_ack: boolean
  /** Nepovinný souhlas s fotkami z kurzu. */
  photo_consent: boolean
  /** Kdy zákazník rezervaci odeslal (ISO z prohlížeče). */
  client_accepted_at?: string
}

/** Krátký otisk textu (FNV-1a, 32 bit) — pozná se z něj, které znění storna zákazník viděl. */
const textFingerprint = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
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
  /** Schválená žádost o místo — zákazník si ještě vybírá platbu a potvrzuje podmínky. */
  payment_choice_pending?: boolean
  /** Rozpracovaná změna počtu osob — platí, až projde doplatek. */
  pending_change?: { party_size: number; total_price: number; amount: number } | null
  /**
   * Živý stav platby u ComGate (`canceled` = zákazník klikl „Zrušit platbu",
   * `pending` = platba otevřená, třeba po „Návrat do e-shopu"). Jen u
   * nezaplacené online rezervace, jinak null.
   */
  gateway_status?: string | null
  /** Zaplaceno celkem (prvotní platba + doplatky − vrácené). */
  paid_amount?: number
  /** Zbývá doplatit — po přidání osob u zaplacené rezervace. */
  amount_due?: number
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
  /* Verze OP a otisk zobrazeného znění storno podmínek se doplní TADY, na
     serveru — z publikovaného registru právních dokumentů (repo + Studio)
     a z faktu `course.cancellation` z administrace obchodu (tentýž text, jaký
     zákazník viděl v rezervaci), ne z prohlížeče. Backend je uloží
     k rezervaci (`consents`). */
  const [registry, facts] = await Promise.all([getPublishedLegalRegistry(), getLegalFacts()])
  const termsVersion = registry.currentTermsVersion()
  const stornoText = inlineToPlain("{{course.cancellation}}", { facts })
  try {
    const result = await sdk.client.fetch<{
      reservation_id: string
      token: string
      payment_url?: string
    }>(`/store/courses/reservations`, {
      method: "POST",
      headers,
      body: {
        ...input,
        terms_version: termsVersion,
        cancellation_terms_text_version: `${termsVersion}:${textFingerprint(stornoText)}`,
      },
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
  /** Telefon — u žádosti o místo volá majitelka. */
  phone: string
  /** Vzkaz k žádosti (nepovinný). */
  note?: string
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

export type CoursePartyChangePreview = {
  party_size: number
  pricing_tier: string
  per_person: number
  total_price: number
  paid_amount: number
  action: "supplement" | "refund" | "none"
  amount: number
  seats_ok: boolean
  message?: string
}

/** Shrnutí změny počtu osob před potvrzením — nic neukládá. */
export const previewCoursePartyChange = async (
  reservationId: string,
  token: string,
  partySize: number
): Promise<CoursePartyChangePreview | null> =>
  sdk.client
    .fetch<{ preview: CoursePartyChangePreview }>(
      `/store/courses/reservations/${reservationId}/edit/preview?token=${encodeURIComponent(token)}`,
      { method: "POST", body: { party_size: partySize }, cache: "no-store" }
    )
    .then((result) => result.preview)
    .catch(() => null)

/** „Zrušit změnu" — zahodí rozpracovanou změnu (čekající doplatek). */
export const discardCourseChange = async (reservationId: string, token: string): Promise<boolean> =>
  sdk.client
    .fetch(`/store/courses/reservations/${reservationId}/edit/discard?token=${encodeURIComponent(token)}`, {
      method: "POST",
      cache: "no-store",
    })
    .then(() => true)
    .catch(() => false)

/**
 * Potvrzení schválené výjimky (žádost o místo): volba platby + souhlasy.
 * Verze OP a otisk storno podmínek doplní server, jako u běžné rezervace.
 */
export const confirmCourseReservation = async (
  reservationId: string,
  token: string,
  input: { payment_method: "online" | "on_site"; terms_accepted: true; photo_consent: boolean }
): Promise<{ ok: true; payment_url?: string } | { ok: false; message: string }> => {
  const [registry, facts] = await Promise.all([getPublishedLegalRegistry(), getLegalFacts()])
  const termsVersion = registry.currentTermsVersion()
  const stornoText = inlineToPlain("{{course.cancellation}}", { facts })
  try {
    const result = await sdk.client.fetch<{ ok: boolean; payment_url?: string }>(
      `/store/courses/reservations/${reservationId}/confirm?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        body: {
          ...input,
          exception_ack: true,
          terms_version: termsVersion,
          cancellation_terms_text_version: `${termsVersion}:${textFingerprint(stornoText)}`,
          client_accepted_at: new Date().toISOString(),
        },
        cache: "no-store",
      }
    )
    return { ok: true, payment_url: result.payment_url }
  } catch (error) {
    return { ok: false, message: readableMessage(error, "Rezervaci se nepodařilo potvrdit. Zkuste to prosím znovu.") }
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
 * either proof. The backend enforces the 24h cutoff, frees the seats, runs
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
      paid_amount: number
      amount_due: number
      /** Doplatek po přidání osob — rovnou na platební bránu. */
      payment_url?: string
      /** Co se s penězi stalo (doplatek / vrácení rozdílu). */
      change?:
        | { action: "none" }
        | { action: "supplement"; amount: number }
        | { action: "refund"; amount: number; refunded: boolean }
    }
  | { ok: false; message: string }

/**
 * The customer changes their party size (same auth as the cancel). Allowed
 * only before the 24h cutoff and while nothing was paid online; capacity and
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
        paid_amount?: number
        amount_due?: number
      }
      payment_url?: string
      change?: Extract<EditCourseReservationResult, { ok: true }>["change"]
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
      paid_amount: result.reservation.paid_amount ?? 0,
      amount_due: result.reservation.amount_due ?? 0,
      payment_url: result.payment_url,
      change: result.change,
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
