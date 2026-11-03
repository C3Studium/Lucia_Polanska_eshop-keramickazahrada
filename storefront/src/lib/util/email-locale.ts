/**
 * Jazyk e-mailů a dokumentů pro zemi z přepínače zemí.
 *
 * Storefront zůstává česky (web přeloží prohlížeč), ale e-maily, PDF
 * a platební brána ne — ty jdou v jazyce země, kterou si zákazník zvolil.
 * Mapování je totéž jako v backendu (`backend/src/lib/email-locale.ts`):
 * cz → čeština, sk → slovenština, pl → polština, de/at → němčina, ostatní
 * země angličtina, bez země čeština. Storefront jazyk zapisuje (košík,
 * registrace, odběr novinek), backend ho čte.
 */
export type EmailLocale = "cs" | "sk" | "pl" | "de" | "en"

const COUNTRY_LOCALE: Record<string, EmailLocale> = {
  cz: "cs",
  sk: "sk",
  pl: "pl",
  de: "de",
  at: "de",
}

export const localeForCountry = (code?: string | null): EmailLocale => {
  const country = (code ?? "").trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(country)) return "cs"
  return COUNTRY_LOCALE[country] ?? "en"
}
