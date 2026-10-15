import type { MedusaContainer } from "@medusajs/framework/types"
import { EMAIL_OPTOUT_MODULE } from "../modules/email-optout"
import { normalizeEmail } from "./newsletter-link"
import type { EmailOptOutKind } from "./email-optout-link"

/**
 * Kdo které e-maily z oprávněného zájmu odmítl (`email_opt_out`) — čtení pro
 * joby a odesílání, zápis pro routu `GET /email-optout`.
 *
 * Odkaz a podpis jsou v `email-optout-link.ts` (bez frameworku); tady je jen
 * práce s modulem. Funkce berou úzké rozhraní služby, ne kontejner, ať se
 * pravidla „koho přeskočit" dají dokázat v unit testu bez databáze.
 */

/** Část služby modulu, kterou tahle pravidla potřebují. */
export type EmailOptOutStore = {
  listEmailOptOuts: (filters: any, config?: any) => Promise<any[]>
  createEmailOptOuts: (data: any) => Promise<any>
}

export const emailOptOutStore = (container: MedusaContainer): EmailOptOutStore =>
  container.resolve<EmailOptOutStore>(EMAIL_OPTOUT_MODULE)

/**
 * Normalizované adresy z `emails`, které daný druh odmítly. Prázdné adresy
 * se přeskočí (a nikdy se pro ně nedotazuje).
 */
export const optedOutEmails = async (
  store: Pick<EmailOptOutStore, "listEmailOptOuts">,
  emails: Array<string | null | undefined>,
  kind: EmailOptOutKind
): Promise<Set<string>> => {
  const normalized = [
    ...new Set(emails.map((email) => normalizeEmail(email ?? "")).filter(Boolean)),
  ]
  if (!normalized.length) {
    return new Set()
  }
  const rows = await store.listEmailOptOuts(
    { email: normalized, kind },
    { take: normalized.length }
  )
  return new Set(
    rows
      // Dotaz filtruje druh už v databázi; tohle jen pojistka, ať odmítnutí
      // recenzí nikdy nezastaví jiný druh e-mailu.
      .filter((row) => !row?.kind || row.kind === kind)
      .map((row) => normalizeEmail(String(row?.email ?? "")))
      .filter(Boolean)
  )
}

/** Je adresa v množině odmítnutých? (Normalizuje, stejně jako dotaz.) */
export const isInOptOutSet = (
  set: Set<string>,
  email: string | null | undefined
): boolean => {
  const normalized = normalizeEmail(email ?? "")
  return Boolean(normalized) && set.has(normalized)
}

/** Jedna adresa — pro odeslání jednoho e-mailu (recenze z jobu i z adminu). */
export const isEmailOptedOut = async (
  container: MedusaContainer,
  email: string | null | undefined,
  kind: EmailOptOutKind
): Promise<boolean> =>
  isInOptOutSet(await optedOutEmails(emailOptOutStore(container), [email], kind), email)

/**
 * Zapíše odmítnutí. Idempotentní: druhé kliknutí (i souběžné — unikátní
 * index (email, kind)) skončí jako `existing`, ne chybou.
 */
export const recordEmailOptOut = async (
  store: EmailOptOutStore,
  email: string,
  kind: EmailOptOutKind
): Promise<"created" | "existing"> => {
  const normalized = normalizeEmail(email)
  const already = await optedOutEmails(store, [normalized], kind)
  if (already.has(normalized)) {
    return "existing"
  }
  try {
    await store.createEmailOptOuts({ email: normalized, kind })
    return "created"
  } catch (error) {
    // Souběžné kliknutí (prefetch poštovního klienta + člověk) narazí na
    // unikátní index — řádek pak už existuje a odmítnutí platí.
    const again = await optedOutEmails(store, [normalized], kind)
    if (again.has(normalized)) {
      return "existing"
    }
    throw error
  }
}
