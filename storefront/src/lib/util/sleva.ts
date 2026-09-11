/**
 * Poznává v košíku kusy, na které slevový kód neplatí.
 *
 * ## Proč se to ptá třemi způsoby
 *
 * Rozhoduje backend, ne obchod: Medusa při výpočtu akce vynechá položku
 * s `is_discountable: false` a ta hodnota se na položku obtiskne z
 * `product.discountable` ve chvíli přidání do košíku (pravidlo a jeho důvody
 * jsou v `backend/src/lib/discountable.ts`). To je tedy první a jediná
 * autoritativní otázka.
 *
 * Zbylé dvě jsou pro košíky, které vznikly dřív, než pravidlo začalo platit —
 * jejich položky mají obtisknuté staré `true`:
 *
 * - `compare_at_unit_price` Medusa vyplní, jen když cena přišla z výprodejového
 *   ceníku, tedy u sezónní akce.
 * - `metadata.clearance` na produktu je ruční příznak Výprodej.
 *
 * Slouží to jenom k tomu, co se zákazníkovi napíše. O tom, kolik se strhne,
 * rozhoduje pořád backend — kdyby tahle úvaha byla vedle, spočítá se sleva
 * správně a nesedět bude jen věta.
 */

type Polozka = {
  is_discountable?: boolean | null
  compare_at_unit_price?: number | null
  product?: { metadata?: Record<string, unknown> | null } | null
}

/** Je tenhle kus zlevněný, a tedy mimo dosah slevových kódů? */
export const jeZlevnenaPolozka = (polozka: Polozka | null | undefined): boolean => {
  if (!polozka) {
    return false
  }
  if (polozka.is_discountable === false) {
    return true
  }
  if (
    polozka.compare_at_unit_price !== null &&
    polozka.compare_at_unit_price !== undefined
  ) {
    return true
  }
  return polozka.product?.metadata?.clearance === true
}

/** Obsahuje košík aspoň jeden zlevněný kus? */
export const maZlevnenePolozky = (
  polozky: readonly (Polozka | null | undefined)[] | null | undefined
): boolean => (polozky ?? []).some(jeZlevnenaPolozka)
