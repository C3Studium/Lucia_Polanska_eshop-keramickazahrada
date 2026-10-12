/**
 * Identita a pořadí položek balného (lib/packaging.ts) — čisté funkce bez
 * závislostí, ať je můžou použít i e-mailové šablony a faktura.
 */

/** Značka v metadatech řádku — na ní stojí všechny stráže. */
export const PACKAGING_MARKER = "packaging_fee"
/** Ke které variantě balné patří (přežije převod košíku na objednávku). */
export const PACKAGING_VARIANT_KEY = "packaging_variant_id"
export const PACKAGING_PRODUCT_KEY = "packaging_product_id"
export const PACKAGING_TITLE = "Balné"

type LineLike = {
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
}

/**
 * Řádek balného = značka A žádný produkt za ním. Metadata umí poslat každý
 * klient, ale zákaznické routy vždy chtějí variantu — řádek bez varianty se
 * značkou zakládá jen server.
 */
export const isPackagingLine = (item: LineLike | null | undefined): boolean =>
  Boolean(item?.metadata?.[PACKAGING_MARKER]) && !item?.variant_id && !item?.product_id

/**
 * Servisní řádek = balné nebo doběrečné (lib/dobirka-fee.ts, stejná
 * identita: značka a žádný produkt za řádkem). Není to zboží — pravidla typu
 * „všechny položky jsou zakázka" nebo „každý kus dovolí dobírku" ho musí
 * přeskočit, jinak by je jediný řádek balného otočil.
 */
export const isServiceLine = (item: LineLike | null | undefined): boolean =>
  isPackagingLine(item) ||
  (Boolean(item?.metadata?.dobirka_fee) && !item?.variant_id && !item?.product_id)

/** Varianta, ke které balné patří (null u běžného řádku). */
export const packagingVariantOf = (item: LineLike | null | undefined): string | null =>
  isPackagingLine(item) ? String(item?.metadata?.[PACKAGING_VARIANT_KEY] ?? "") || null : null

/** „Balné — Keramické pítko" — tak ho čte zákazník i faktura. */
export const packagingTitleFor = (productTitle?: string | null): string =>
  productTitle && productTitle.trim() ? `${PACKAGING_TITLE} — ${productTitle.trim()}` : PACKAGING_TITLE

/**
 * Pořadí řádků pro výpis: každé balné hned pod svým výrobkem, balné bez
 * výrobku na konec, jinak pořadí beze změny. (Balné vzniká po výrobku, takže
 * by jinak skončilo až za všemi výrobky.)
 */
export const withPackagingUnderProducts = <T extends LineLike>(items: T[]): T[] => {
  const packaging = items.filter(isPackagingLine)
  const used = new Set<T>()
  const result: T[] = []
  for (const item of items) {
    if (isPackagingLine(item)) continue
    result.push(item)
    for (const line of packaging) {
      if (!used.has(line) && item.variant_id && packagingVariantOf(line) === item.variant_id) {
        result.push(line)
        used.add(line)
      }
    }
  }
  return [...result, ...packaging.filter((line) => !used.has(line))]
}
