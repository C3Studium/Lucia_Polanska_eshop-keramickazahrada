/**
 * Co ještě zbývá vyskladnit / odeslat — položky pro
 * `createOrderFulfillmentWorkflow` a `createOrderShipmentWorkflow`.
 *
 * ČISTÉ funkce, protože tu 9. 10. 2026 vznikla tichá chyba: `query.graph`
 * vrací množství v některých projekcích (zejména při výslovném výběru
 * `items.quantity` / `items.detail.shipped_quantity`, ne přes `items.*`) jako
 * BigNumber objekt `{ value: "1", precision: 20 }`, ne jako číslo.
 * `Number(objekt)` je NaN → 0 → „žádné položky k odeslání", ačkoli
 * objednávka #36 měla sedm kusů k odeslání — a žádná objednávka v historii
 * neměla `shipped_at`. Převod proto bere číslo, řetězec i objekt (`value` /
 * `numeric_`), a když `quantity` chybí nebo je 0, sáhne po `raw_quantity`.
 *
 * Dotaz má kromě `items.quantity` a `items.detail.<x>_quantity` vybírat i
 * `items.raw_quantity` a `items.detail.raw_<x>_quantity`.
 *
 * Objednané množství čte sdílené `lineQuantityOf` (`lib/order-quantity`) —
 * stejná funkce jako editace, štítek, statistiky. Tady zůstává jen průběh
 * (`detail.shipped_quantity` / `detail.fulfilled_quantity`) a rozdíl.
 */

import { toNumber } from "../claims/refund-rules"
import { LINE_QUANTITY_FIELDS, lineQuantityOf } from "../order-quantity"
import { isServiceLine } from "../packaging-lines"

export type OutstandingItem = { id: string; quantity: number }

export type ProgressField = "shipped_quantity" | "fulfilled_quantity"

/** Průběh (`<field>` → `raw_<field>`) z detailu položky, BigNumber-safe. */
const progressOf = (detail: any, field: ProgressField): number => {
  const direct = toNumber(detail?.[field])
  if (direct > 0) return direct
  return toNumber(detail?.[`raw_${field}`])
}

/**
 * Položky s `requires_shipping`, u kterých `quantity − detail.<field>` > 0 —
 * to, co jde do FYZICKÉHO plnění (podání u dopravce, štítek, osobní odběr).
 *
 * ## Servisní řádky (balné, doběrečné) sem NEpatří
 *
 * 14. 10. 2026 se sem přidaly, aby objednávka nezůstala „Částečně splněno"
 * (#50). Medusa ale jedno plnění se zbožím a s řádky bez dopravy odmítne
 * („Fulfillment can only be created entirely with items with shipping or items
 * without shipping") — a tím padalo generování štítku, „Vytvořit zásilku
 * a odeslat" i dokončení osobního odběru u KAŽDÉ objednávky s balným (změřeno
 * v logu produkce 16. 10.). Druhé, samostatné plnění pro balné by navíc šlo
 * přes téhož dopravce: Medusa volá providera u každého plnění, takže by Česká
 * pošta dostala druhé podání.
 *
 * Servisní řádky se proto vyřizují zvlášť a bez dopravce —
 * `lib/service-lines-settle.ts` je po skutečném odeslání jen zapíše
 * v modulu objednávek jako vyskladněné a odeslané.
 */
export const outstandingItemsOf = (
  order: any,
  field: ProgressField
): OutstandingItem[] =>
  ((order?.items || []) as any[])
    .filter((item) => item?.requires_shipping)
    .map((item) => ({
      id: String(item.id),
      quantity: lineQuantityOf(item) - progressOf(item?.detail, field),
    }))
    .filter((item) => item.quantity > 0)

/** K odeslání (shipment). */
export const shipmentItemsOf = (order: any): OutstandingItem[] =>
  outstandingItemsOf(order, "shipped_quantity")

/** K vyskladnění (fulfillment). */
export const fulfillmentItemsOf = (order: any): OutstandingItem[] =>
  outstandingItemsOf(order, "fulfilled_quantity")

/**
 * Servisní řádky (balné, doběrečné), které ještě nejsou vyskladněné / odeslané
 * — pro `lib/service-lines-settle.ts`, NE pro plnění u dopravce.
 *
 * `fulfill` = kolik zbývá zapsat jako vyskladněné; `ship` = kolik zbývá zapsat
 * jako odeslané, počítáno proti celému množství (po `fulfill` je vyskladněné
 * všechno).
 */
export const serviceLinesOutstanding = (
  order: any
): { fulfill: OutstandingItem[]; ship: OutstandingItem[] } => {
  const lines = ((order?.items || []) as any[]).filter(
    (item) => !item?.requires_shipping && isServiceLine(item)
  )
  const remaining = (field: ProgressField) =>
    lines
      .map((item) => ({
        id: String(item.id),
        quantity: lineQuantityOf(item) - progressOf(item?.detail, field),
      }))
      .filter((item) => item.quantity > 0)
  return { fulfill: remaining("fulfilled_quantity"), ship: remaining("shipped_quantity") }
}

/** Pole dotazu, která výpočet potřebuje — ať je každý volající vybírá stejně. */
export const OUTSTANDING_ITEM_FIELDS = [
  "items.id",
  ...LINE_QUANTITY_FIELDS,
  "items.requires_shipping",
  // Servisní řádek (balné/doběrečné) = značka v metadatech a žádný produkt.
  "items.metadata",
  "items.variant_id",
  "items.product_id",
  "items.detail.fulfilled_quantity",
  "items.detail.raw_fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.raw_shipped_quantity",
]
