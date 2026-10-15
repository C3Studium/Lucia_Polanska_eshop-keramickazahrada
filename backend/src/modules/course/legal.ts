/**
 * Právní texty kurzů, které posílá backend (potvrzovací e-mail) — na jednom
 * místě, ať se doplňují jednou.
 *
 * Storefront má fakta v `storefront/src/lib/legal/facts.ts` (`course.cancellation`);
 * backend ten soubor nemá, proto zástupný text tady. Až Lucie storno podmínky
 * potvrdí (docs/legal/OPEN_QUESTIONS.md, bod 7), nahradí se TADY a stejným
 * zněním v `facts.ts`.
 *
 * Bez importů — čte to i React Email šablona.
 */

/** Storno podmínky kurzů do e-mailů. */
export const COURSE_CANCELLATION_TERMS = "[[DOPLNIT: storno podmínky kurzů]]"

/**
 * Kapitola obchodních podmínek o kurzech (storefront `obchodni-podminky`,
 * sekce `kurzy` — „X. Keramické kurzy"). Při přečíslování OP změnit i tady.
 */
export const COURSE_TERMS_ARTICLE = "čl. X Keramické kurzy"

/**
 * Jsou storno podmínky opravdu doplněné? Dokud text nese `[[DOPLNIT`, e-mail
 * ho necituje — zástupný text zákazníkovi nikdy — a místo něj odkáže na
 * `COURSE_TERMS_ARTICLE`.
 */
export const hasCourseCancellationTerms = (
  text: string | null | undefined = COURSE_CANCELLATION_TERMS
): boolean =>
  typeof text === "string" && text.trim().length > 0 && !text.includes("[[DOPLNIT")

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
