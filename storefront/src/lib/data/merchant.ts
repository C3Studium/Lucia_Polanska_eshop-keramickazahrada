import "server-only"

export type MerchantIdentity = {
  name: string
  address: string
  registrationNumber: string
  email: string
  phone: string
  /** Dial-safe form for `tel:` — the display form carries spaces. */
  phoneDial: string
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
})
