/**
 * Co ještě zbývá odeslat — položky pro `createOrderShipmentWorkflow`.
 *
 * ČISTÁ funkce, protože tu 9. 10. 2026 vznikla tichá chyba: `query.graph`
 * vrací množství položek v některých projekcích jako BigNumber objekt
 * (`{ value: "1", precision: 20 }`), ne jako číslo. `Number(objekt)` je NaN
 * → 0 → „žádné položky k odeslání", ačkoli objednávka #36 měla sedm kusů
 * k odeslání. Převod proto bere číslo, řetězec i objekt (`value` /
 * `numeric_`), a když chybí `quantity`, sáhne po `raw_quantity`.
 */

import { toNumber } from "../claims/refund-rules"

export type ShipmentItem = { id: string; quantity: number }

const quantityOf = (item: any, field: "quantity" | "shipped_quantity"): number => {
  const direct = toNumber(item?.[field])
  if (direct > 0) return direct
  return toNumber(item?.[`raw_${field}`])
}

export const shipmentItemsOf = (order: any): ShipmentItem[] =>
  ((order?.items || []) as any[])
    .filter((item) => item?.requires_shipping)
    .map((item) => ({
      id: String(item.id),
      quantity: quantityOf(item, "quantity") - quantityOf(item?.detail, "shipped_quantity"),
    }))
    .filter((item) => item.quantity > 0)
