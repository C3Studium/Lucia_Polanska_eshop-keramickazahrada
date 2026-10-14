import { z } from "zod"
import type { CourseReservationConsents } from "../../../../modules/course/legal"

/**
 * Tvar veřejné rezervace kurzu (`POST /store/courses/reservations`).
 *
 * Mimo `route.ts`, aby šel otestovat bez frameworku. Souhlasy (právní audit
 * § 5): rezervace kurzu je smlouva o službě v pevném termínu — bez souhlasu
 * s OP a bez potvrzeného poučení, že od ní nelze odstoupit do 14 dnů
 * (§ 1837 písm. j) OZ), se nepřijme. Fotky jsou nepovinné.
 */

export const TERMS_REQUIRED_MESSAGE =
  "Pro rezervaci je potřeba souhlasit s obchodními podmínkami."
export const EXCEPTION_REQUIRED_MESSAGE =
  "Pro rezervaci prosím potvrďte, že u kurzu s pevným termínem nelze odstoupit do 14 dnů a platí storno podmínky."

export const ReservationSchema = z.object({
  term_id: z.string().trim().min(1),
  name: z.string().trim().min(2, "Vyplňte prosím jméno.").max(200),
  email: z
    .string()
    .trim()
    .email("Zkontrolujte prosím e-mailovou adresu.")
    .max(320),
  phone: z.string().trim().min(6, "Zkontrolujte prosím telefon.").max(40),
  party_size: z.number().int().min(1).max(30),
  payment_method: z.enum(["online", "on_site"]),
  /** Honeypot — humans never see the field, so any content marks a bot. */
  website: z.string().max(400).optional(),
  /** Souhlas s OP (čl. Kurzy) — povinně `true`. */
  terms_accepted: z.literal(true, { error: TERMS_REQUIRED_MESSAGE }),
  /** Poučení o výjimce z odstoupení (§ 1837 písm. j) OZ) — povinně `true`. */
  exception_ack: z.literal(true, { error: EXCEPTION_REQUIRED_MESSAGE }),
  /** Nepovinný souhlas s fotkami z kurzu. */
  photo_consent: z.boolean().optional(),
  /** Verze OP — doplňuje serverová akce storefrontu z registru dokumentů. */
  terms_version: z.string().trim().max(40).optional(),
  /** Čas odeslání z prohlížeče (ISO). */
  client_accepted_at: z.string().trim().max(40).optional(),
  /** Otisk zobrazeného znění storno podmínek. */
  cancellation_terms_text_version: z.string().trim().max(80).optional(),
})

export type ReservationInput = z.infer<typeof ReservationSchema>

const GENERIC_MESSAGE =
  "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru."

/** Ověří tělo požadavku; chybová hláška je česká a připravená pro zákazníka. */
export const parseReservation = (
  body: unknown
): { ok: true; data: ReservationInput } | { ok: false; message: string } => {
  const parsed = ReservationSchema.safeParse(body ?? {})
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  const first = parsed.error.issues[0]
  return {
    ok: false,
    message:
      first?.message && /[ěščřžýáíéúů]/i.test(first.message)
        ? first.message
        : GENERIC_MESSAGE,
  }
}

const isoOrNull = (value: string | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Záznam souhlasů k rezervaci — `accepted_at` je čas serveru. */
export const buildReservationConsents = (
  input: ReservationInput,
  now: Date = new Date()
): CourseReservationConsents => ({
  terms_version: input.terms_version || null,
  accepted_at: now.toISOString(),
  client_accepted_at: isoOrNull(input.client_accepted_at),
  exception_ack: true,
  photo_consent: input.photo_consent === true,
  cancellation_terms_text_version: input.cancellation_terms_text_version || null,
})
