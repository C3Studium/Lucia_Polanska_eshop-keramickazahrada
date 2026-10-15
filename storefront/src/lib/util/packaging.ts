/**
 * Balné — vlastní položka u každého výrobku (backend lib/packaging.ts,
 * 12. 10. 2026). Přidává ji server: počet kusů jde s výrobkem, zákazník ji
 * sám neupravuje ani neodebírá. Ve výpisech stojí hned pod svým výrobkem.
 *
 * Identita stejná jako u doběrečného: značka v metadatech A žádný produkt
 * za řádkem (metadata umí poslat každý klient, variantu bez produktu ne).
 */

export const PACKAGING_TITLE = "Balné"

type LineLike = {
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
  product_id?: string | null
}

export const isPackagingLine = (item: LineLike | null | undefined): boolean =>
  Boolean(item?.metadata?.packaging_fee) && !item?.variant_id && !item?.product_id

/**
 * Doběrečné — stejná identita jako `isDobirkaFeeLine` v `dobirka.ts` (ten
 * importuje odsud, proto vlastní kopie podmínky místo importu zpět).
 */
const isDobirkaFeeItem = (item: LineLike | null | undefined): boolean =>
  Boolean(item?.metadata?.dobirka_fee) && !item?.variant_id && !item?.product_id

/**
 * Servisní řádek = balné nebo doběrečné (stejná identita jako
 * `isDobirkaFeeLine`). Není to kus zboží — do počtů kusů a do pravidel typu
 * „každý kus…" nepatří.
 */
export const isServiceLine = (item: LineLike | null | undefined): boolean =>
  isPackagingLine(item) || isDobirkaFeeItem(item)

/**
 * Součet doběrečného (cena × kusy) — pro rozpad mezisoučtu, kde je to
 * vlastní řádek „Doběrečné", ne součást „Výrobky". `null`, když v seznamu
 * žádné není.
 */
export const dobirkaFeeSubtotal = (
  items: Array<LineLike & { unit_price?: number | null; quantity?: number | null }> | null | undefined
): number | null => {
  const lines = (items ?? []).filter(isDobirkaFeeItem)
  if (!lines.length) return null
  return lines.reduce(
    (sum, line) => sum + Number(line.unit_price ?? 0) * Number(line.quantity ?? 0),
    0
  )
}

/** Jen kusy zboží (bez balného a doběrečného). */
export const productLines = <T extends LineLike>(items: T[] | null | undefined): T[] =>
  (items ?? []).filter((item) => !isServiceLine(item))

/**
 * Součet balného (cena × kusy; balné se nezlevňuje) — pro rozpad mezisoučtu
 * „Výrobky / Balné". `null`, když v seznamu žádné balné není.
 */
export const packagingSubtotal = (
  items: Array<LineLike & { unit_price?: number | null; quantity?: number | null }> | null | undefined
): number | null => {
  const lines = (items ?? []).filter(isPackagingLine)
  if (!lines.length) return null
  return lines.reduce(
    (sum, line) => sum + Number(line.unit_price ?? 0) * Number(line.quantity ?? 0),
    0
  )
}

const packagingVariantOf = (item: LineLike): string | null =>
  isPackagingLine(item) ? String(item.metadata?.packaging_variant_id ?? "") || null : null

/**
 * Pořadí výpisu: každé balné hned pod svým výrobkem (vzniká až po výrobku,
 * takže by jinak skončilo za všemi výrobky), osiřelé balné na konec.
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
