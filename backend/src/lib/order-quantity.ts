/**
 * Množství řádku objednávky z `query.graph` — JEDNA funkce pro celý backend.
 *
 * ## Proč to nejde číst jako `item.quantity`
 *
 * ZMĚŘENO 9. 10. 2026 na objednávce #36 (produkce): když dotaz vybírá
 * `items.quantity` výslovně (ne přes `items.*`), položka přijde ÚPLNĚ BEZ
 * klíče `quantity`. Množství totiž v modulu objednávek nežije na řádku
 * (`order_line_item` ten sloupec nemá), ale na jeho detailu (`order_item`,
 * v dotazu `items.detail`), a do řádku ho dopočítává jen projekce `items.*`.
 * Admin HTTP route (`GET /admin/orders/:id?fields=items.quantity`) ho vrací,
 * protože jde přes modulový `retrieveOrder`, ne přes `query.graph`.
 *
 * Následky bývaly tiché: `Number(undefined)` je NaN → 0 → „žádné položky
 * k odeslání", výměna varianty s množstvím 1 místo 3, prodeje za 30 dní
 * jako nula. Proto každý dotaz, který množství potřebuje, vybírá
 * `LINE_QUANTITY_FIELDS` a čte přes `lineQuantityOf`.
 *
 * ## Proč BigNumber-aware převod
 *
 * `detail.quantity` je BigNumber sloupec. Většinou přijde jako číslo, ale
 * `raw_quantity` je vždy objekt `{ value, precision }` a modulové instance
 * nosí `numeric_`. `toNumber` z `claims/refund-rules` umí všechny tvary;
 * tady se re-exportuje, ať nové kódy mají jedno místo, odkud ho brát.
 *
 * Košíkové řádky (`cart_line_item`) MAJÍ vlastní sloupec `quantity` — na
 * košík se tahle past nevztahuje a `items.quantity` tam stačí.
 */

import { toNumber } from "./claims/refund-rules"

export { toNumber }

/**
 * Pole, která dotaz na objednávku musí vybrat, aby `lineQuantityOf` mělo
 * z čeho číst — ať každý volající vybírá stejně.
 */
export const LINE_QUANTITY_FIELDS = [
  "items.quantity",
  "items.raw_quantity",
  "items.detail.quantity",
  "items.detail.raw_quantity",
]

export type LineQuantitySource = {
  quantity?: unknown
  raw_quantity?: unknown
  detail?: {
    quantity?: unknown
    raw_quantity?: unknown
  } | null
} | null | undefined

/**
 * Objednané množství řádku: `quantity` → `raw_quantity` → `detail.quantity`
 * → `detail.raw_quantity`. První kladná hodnota vyhrává; když není žádná,
 * vrací 0 (ne NaN), aby součty zůstaly čísly a volající mohl rozhodnout,
 * co s nulou.
 */
export const lineQuantityOf = (item: LineQuantitySource): number => {
  const candidates = [
    item?.quantity,
    item?.raw_quantity,
    item?.detail?.quantity,
    item?.detail?.raw_quantity,
  ]
  for (const candidate of candidates) {
    const parsed = toNumber(candidate)
    if (parsed > 0) return parsed
  }
  return 0
}
