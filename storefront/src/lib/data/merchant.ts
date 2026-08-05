import "server-only"

export type MerchantIdentity = {
  name: string
  address: string
  registrationNumber: string
  email: string
  phone: string
  /** Dial-safe form for `tel:` — the display form carries spaces. */
  phoneDial: string
  website: string
  bankAccount: string
  iban: string
  swift: string
}

/**
 * The seller's legal identity, as it must appear to a Czech customer before they buy.
 *
 * Address and IČO come from the environment (`SIDLO_ADRESA`, `IDENTIFIKACNI_CISLO`) so a change
 * of registered seat does not need a deploy of the storefront's source; the registered values
 * are kept as fallbacks so the block can never render blank if a variable is missing.
 *
 * Server-only: these variables deliberately have no NEXT_PUBLIC prefix. Read this in a layout
 * or page and pass the result down.
 */
export const getMerchantIdentity = (): MerchantIdentity => ({
  name: "Lucie Polanská",
  address: process.env.SIDLO_ADRESA || "Putim 229, 397 01 Písek",
  registrationNumber: process.env.IDENTIFIKACNI_CISLO || "03441482",
  email: "info@keramickazahrada.cz",
  phone: "+420 775 211 578",
  phoneDial: "+420775211578",
  website: process.env.INTERNETOVA_ADRESA || "www.keramickazahrada.cz",
  bankAccount: process.env.CISLO_UCTU || "7010757121/2010",
  iban: process.env.IBAN || "CZ34 2010 0000 0070 1075 7121",
  swift: process.env.SWIFT_KOD || "FIOBCZPPXXX",
})
