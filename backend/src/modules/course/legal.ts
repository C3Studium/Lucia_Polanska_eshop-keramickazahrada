import type { LegalFactKey } from "../../lib/legal-facts"

/**
 * Právní texty kurzů, které posílá backend (potvrzovací e-mail) — na jednom
 * místě, ať se doplňují jednou.
 *
 * Storno podmínky jsou právní údaj `course.cancellation` — vyplňuje je
 * majitelka v administraci („Právní údaje", `lib/legal-facts.ts`) a tentýž
 * text ukazuje web v obchodních podmínkách, na stránce Kurzy i v okně
 * rezervace. Dokud nejsou vyplněné, e-mail je necituje a odkáže na OP čl. X.
 *
 * Bez runtime importů — čte to i React Email šablona.
 */

/**
 * Kapitola obchodních podmínek o kurzech (storefront `obchodni-podminky`,
 * sekce `kurzy` — „X. Keramické kurzy"). Při přečíslování OP změnit i tady.
 */
export const COURSE_TERMS_ARTICLE = "čl. X Keramické kurzy"

/**
 * Jsou storno podmínky opravdu doplněné? Prázdný text (nevyplněný údaj)
 * ani text se zástupným `[[DOPLNIT` (starší uložené notifikace) e-mail
 * necituje — zástupný text zákazníkovi nikdy — a místo něj odkáže na
 * `COURSE_TERMS_ARTICLE`.
 */
export const hasCourseCancellationTerms = (text: string | null | undefined): boolean =>
  typeof text === "string" && text.trim().length > 0 && !text.includes("[[DOPLNIT")

/**
 * Storno podmínky do e-mailu z právních údajů (`course.cancellation`), nebo
 * `""`, dokud nejsou vyplněné — šablona pak odkáže na OP čl. X.
 */
export const courseCancellationTerms = (
  facts: Partial<Record<LegalFactKey, string | null>> | null | undefined
): string => {
  const text = facts?.["course.cancellation"]
  return hasCourseCancellationTerms(text) ? (text as string).trim() : ""
}

/**
 * Poučení o výjimce z práva odstoupit (§ 1837 písm. j) OZ). „Podle storno
 * podmínek" platí i bez doplněného znění — e-mail pak odkáže na OP čl. X.
 */
export const COURSE_NO_WITHDRAWAL_NOTICE =
  "Kurz se koná v pevném termínu, a proto od rezervace nelze odstoupit do 14 dnů (§ 1837 písm. j) občanského zákoníku). Zrušit ji můžete podle storno podmínek."

/** Souhlasy uložené k rezervaci (`course_reservation.consents`). */
export type CourseReservationConsents = {
  /** Verze obchodních podmínek, se kterou zákazník rezervoval. */
  terms_version: string | null
  /** Serverový čas přijetí rezervace se souhlasy (ISO). */
  accepted_at: string
  /** Čas z prohlížeče (ISO), jak ho poslal storefront. */
  client_accepted_at: string | null
  /** Potvrdil poučení o výjimce z odstoupení (§ 1837 písm. j) OZ). */
  exception_ack: true
  /** Nepovinný souhlas s fotkami z kurzu a jejich zveřejněním. */
  photo_consent: boolean
  /** Verze (otisk) zobrazeného znění storno podmínek. */
  cancellation_terms_text_version: string | null
}

/** Řádek do upozornění majitelce: smí fotit? */
export const photoConsentLine = (consents: unknown): string => {
  const value = (consents as { photo_consent?: unknown } | null)?.photo_consent
  if (value === true) return "Fotky z kurzu: souhlasí se zveřejněním."
  if (value === false) return "Fotky z kurzu: BEZ souhlasu — nefotit / nezveřejňovat."
  return "Fotky z kurzu: souhlas nezaznamenán."
}
