/**
 * Kam zákazníka poslat napsat recenzi na Google (docs/sledovani-zasilek.md §6).
 *
 * Bez importů — čte ho React Email šablona `order-review.tsx` i job
 * `request-reviews`, stejně jako `storefront-url.ts`.
 *
 * Pořadí:
 * 1. `GOOGLE_REVIEW_URL` — celá adresa (např. krátký odkaz z Firemního profilu
 *    Google), má přednost, protože ji majitelka vidí a umí si ji ověřit;
 * 2. `GOOGLE_PLACE_ID` → `search.google.com/local/writereview?placeid=…`,
 *    což otevře rovnou Googlí dialog pro napsání recenze. Je to nejbližší
 *    „widget", který v e-mailu existuje — poštovní klienti skripty
 *    nespouštějí, interaktivní hodnocení do e-mailu vložit nejde;
 * 3. nic → `null`, e-mail spadne na dnešní hodnocení produktu na webu.
 */
export const GOOGLE_WRITE_REVIEW_BASE =
  "https://search.google.com/local/writereview?placeid="

export const googleReviewUrl = (
  env: Record<string, string | undefined> = process.env
): string | null => {
  const full = (env.GOOGLE_REVIEW_URL ?? "").trim()
  if (full) {
    return full
  }
  const placeId = (env.GOOGLE_PLACE_ID ?? "").trim()
  if (placeId) {
    return `${GOOGLE_WRITE_REVIEW_BASE}${encodeURIComponent(placeId)}`
  }
  return null
}
