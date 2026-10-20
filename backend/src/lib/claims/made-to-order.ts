/**
 * Zakázka na míru — jedna detekce pro celý modul reklamací (§1837 písm. d) OZ).
 *
 * Čistý soubor bez závislostí: importuje ho kontext, intake, lhůta odstoupení
 * i vlajky případu v adminu, ať všichni říkají totéž.
 *
 * ## Tři signály, stačí jeden
 *
 * - `item.metadata.made_to_order` — zadání (brief) zapsané na řádek objednávky;
 * - `product.metadata.made_to_order` — značka z profilu výroby;
 * - kategorie **Zakázková výroba** (`zakazkova-vyroba`) — tak je dnes uspořádaný
 *   katalog (devět produktů v kategorii profil výroby nemá). Do 14. 10. 2026
 *   ji modul reklamací přehlížel, takže zakázkové domovní číslo bez profilu šlo
 *   „odstoupit" jako běžné zboží. Stejný handle čte brána dobírky
 *   (`workflows/hooks/validate-dobirka.ts`) i storefront (`lib/util/commission`).
 *
 * Pozor: produkty, které mají „na zakázku" jen v názvu, zakázkou NEJSOU —
 * prodávají se jako běžné zboží (rozhodnutí na majitelce).
 */

export const COMMISSION_CATEGORY_HANDLE = "zakazkova-vyroba"

export type MadeToOrderSource = {
  metadata?: Record<string, unknown> | null
  product?: {
    metadata?: Record<string, unknown> | null
    categories?: Array<{ handle?: string | null } | null> | null
  } | null
}

/** Položka je v kategorii Zakázková výroba. */
export const isCommissionCategoryItem = (
  item: MadeToOrderSource | null | undefined
): boolean =>
  (item?.product?.categories ?? []).some(
    (category) => category?.handle === COMMISSION_CATEGORY_HANDLE
  )

/**
 * Zakázka na míru = položka označená `made_to_order` (na řádku objednávky nebo
 * na produktu), nebo produkt v kategorii Zakázková výroba.
 */
export const isMadeToOrderItem = (
  item: MadeToOrderSource | null | undefined
): boolean =>
  Boolean((item?.metadata as any)?.made_to_order) ||
  Boolean((item?.product?.metadata as any)?.made_to_order) ||
  isCommissionCategoryItem(item)
