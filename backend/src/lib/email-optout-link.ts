import {
  backendBase,
  normalizeEmail,
  signToken,
  verifyToken,
} from "./newsletter-link"

/**
 * Odkaz „Odhlásit je jedním kliknutím" v e-mailech, které posíláme
 * z oprávněného zájmu bez souhlasu — prosba o recenzi, pokles ceny
 * v oblíbených, připomenutí košíku. Zákon chce v KAŽDÉM takovém e-mailu
 * jednoduchý způsob, jak další odmítnout (§ 7 odst. 3 zákona č. 480/2004 Sb.,
 * námitka čl. 21 GDPR); OP čl. XIV a Zásady to slibují.
 *
 * Stejný vzor jako newsletter (`newsletter-link.ts`): GET z poštovního
 * klienta bez přihlášení a bez publishable key, takže odkaz sám dokazuje, že
 * ho držitel dostal — HMAC adresy pod účelem `email-optout:<druh>`. Každý
 * druh má vlastní účel, takže token pro recenze neodhlásí poklesy cen a token
 * newsletteru neprojde vůbec. Nikdy nevyprší: kdo si poštu uklízí po půl
 * roce, musí se pořád umět odhlásit.
 *
 * Bez importu Medusa frameworku — čte to i job a testy bez kontejneru.
 */

export const EMAIL_OPTOUT_KINDS = [
  "review_request",
  "price_drop",
  "abandoned_cart",
] as const

export type EmailOptOutKind = (typeof EMAIL_OPTOUT_KINDS)[number]

export const isEmailOptOutKind = (value: unknown): value is EmailOptOutKind =>
  typeof value === "string" &&
  (EMAIL_OPTOUT_KINDS as readonly string[]).includes(value)

/** Druh slovy (2. pád množného čísla) — do logu a na stránku po odhlášení. */
export const EMAIL_OPTOUT_KIND_LABEL: Record<EmailOptOutKind, string> = {
  review_request: "prosby o hodnocení nákupu",
  price_drop: "upozornění na nižší cenu výrobků v oblíbených",
  abandoned_cart: "připomenutí nedokončeného nákupu",
}

const purposeOf = (kind: EmailOptOutKind): string => `email-optout:${kind}`

export const signEmailOptOutToken = (email: string, kind: EmailOptOutKind): string =>
  signToken(purposeOf(kind), email)

export const verifyEmailOptOutToken = (
  email: string,
  kind: unknown,
  token: unknown
): boolean =>
  isEmailOptOutKind(kind) && verifyToken(signEmailOptOutToken(email, kind), token)

/**
 * Absolutní odkaz do patičky e-mailu, nebo `null` — bez nastavené adresy
 * backendu (`BACKEND_PUBLIC_URL` / `MEDUSA_BACKEND_URL`) by to byl mrtvý
 * odkaz a šablona pak řádek nevykreslí. Top-level routa (`/email-optout`),
 * ne `/store/...`: tam Medusa vyžaduje publishable key a pošta žádný nepošle.
 */
export const emailOptOutUrl = (
  email: string | null | undefined,
  kind: EmailOptOutKind
): string | null => {
  const base = backendBase()
  const normalized = normalizeEmail(email ?? "")
  if (!base || !normalized) {
    return null
  }
  return `${base}/email-optout?email=${encodeURIComponent(normalized)}&kind=${kind}&token=${signEmailOptOutToken(
    normalized,
    kind
  )}`
}
