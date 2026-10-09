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
 */

import { toNumber } from "../claims/refund-rules"

export type OutstandingItem = { id: string; quantity: number }

export type ProgressField = "shipped_quantity" | "fulfilled_quantity"

const quantityOf = (
  item: any,
  field: "quantity" | ProgressField
): number => {
  const direct = toNumber(item?.[field])
  if (direct > 0) return direct
  return toNumber(item?.[`raw_${field}`])
}

/**
 * Objednané množství položky. ZMĚŘENO 9. 10. 2026 na #36: při výslovném
 * výběru `items.quantity` přijde položka BEZ `quantity` — množství žije na
 * `detail` (OrderItem) a do položky ho dopočítává jen `items.*`. Proto se
 * zkouší položka i detail, v obou číslo i raw podoba.
 */
const orderedQuantityOf = (item: any): number => {
  const own = quantityOf(item, "quantity")
  if (own > 0) return own
  return quantityOf(item?.detail, "quantity")
}

/** Položky s `requires_shipping`, u kterých `quantity − detail.<field>` > 0. */
export const outstandingItemsOf = (
  order: any,
  field: ProgressField
): OutstandingItem[] =>
  ((order?.items || []) as any[])
    .filter((item) => item?.requires_shipping)
    .map((item) => ({
      id: String(item.id),
      quantity: orderedQuantityOf(item) - quantityOf(item?.detail, field),
    }))
    .filter((item) => item.quantity > 0)

/** K odeslání (shipment). */
export const shipmentItemsOf = (order: any): OutstandingItem[] =>
  outstandingItemsOf(order, "shipped_quantity")

/** K vyskladnění (fulfillment). */
export const fulfillmentItemsOf = (order: any): OutstandingItem[] =>
  outstandingItemsOf(order, "fulfilled_quantity")

/** Pole dotazu, která výpočet potřebuje — ať je každý volající vybírá stejně. */
export const OUTSTANDING_ITEM_FIELDS = [
  "items.id",
  "items.quantity",
  "items.raw_quantity",
  "items.requires_shipping",
  "items.detail.quantity",
  "items.detail.raw_quantity",
  "items.detail.fulfilled_quantity",
  "items.detail.raw_fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.raw_shipped_quantity",
]
