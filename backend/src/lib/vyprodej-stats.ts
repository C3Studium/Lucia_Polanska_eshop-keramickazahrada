import { toNumber } from "./claims/refund-rules"

/**
 * Statistiky výprodejů (18. 11. 2026, Slevy → Výprodeje).
 *
 * Kus se počítá výprodeji, když:
 * - je z výrobku, který výprodej kdy zlevnil (i když už vypadl — „do
 *   vyprodání zásob" prodaný kus z výprodeje vyřadí),
 * - objednávka vznikla v období výprodeje a není zrušená,
 * - položka se prodala za nižší cenu, než byla běžná
 *   (`compare_at_unit_price` > `unit_price`; Medusa ho u položky zapíše,
 *   když cenu dal akční ceník). Kus za plnou cenu v tom období se nepočítá.
 */

export type VyprodejWindow = {
  id: string
  start: string
  end: string | null
  productIds: string[]
}

export type VyprodejStats = {
  orders: number
  units: number
  /** Tržba za zlevněné kusy (Kč, s DPH). */
  revenue: number
  /** Kolik zákazníci ušetřili proti běžné ceně. */
  saved: number
  top: Array<{ product_id: string; title: string; units: number }>
}

type OrderRow = {
  id: string
  created_at: string | Date
  status?: string | null
  items?: Array<{
    product_id?: string | null
    title?: string | null
    product_title?: string | null
    unit_price?: unknown
    compare_at_unit_price?: unknown
    quantity?: unknown
  } | null> | null
}

const round = (value: number) => Math.round(value * 100) / 100

export const computeVyprodejStats = (
  windows: VyprodejWindow[],
  orders: OrderRow[],
  now: Date = new Date()
): Map<string, VyprodejStats> => {
  const out = new Map<string, VyprodejStats>()
  for (const window of windows) {
    const start = new Date(window.start).getTime()
    const end = window.end ? new Date(window.end).getTime() : now.getTime()
    const products = new Set(window.productIds)
    const orderIds = new Set<string>()
    const byProduct = new Map<string, { title: string; units: number }>()
    let units = 0
    let revenue = 0
    let saved = 0

    for (const order of orders) {
      if (order.status === "canceled") continue
      const at = new Date(order.created_at).getTime()
      if (at < start || at > end) continue
      for (const line of order.items ?? []) {
        if (!line?.product_id || !products.has(line.product_id)) continue
        const unit = toNumber(line.unit_price)
        const compare = toNumber(line.compare_at_unit_price)
        if (!(compare > unit)) continue
        const quantity = toNumber(line.quantity) || 1
        orderIds.add(order.id)
        units += quantity
        revenue += unit * quantity
        saved += (compare - unit) * quantity
        const entry = byProduct.get(line.product_id) ?? {
          title: String(line.product_title || line.title || line.product_id),
          units: 0,
        }
        entry.units += quantity
        byProduct.set(line.product_id, entry)
      }
    }

    out.set(window.id, {
      orders: orderIds.size,
      units,
      revenue: round(revenue),
      saved: round(saved),
      top: [...byProduct.entries()]
        .map(([product_id, entry]) => ({ product_id, title: entry.title, units: entry.units }))
        .sort((a, b) => b.units - a.units || a.title.localeCompare(b.title, "cs"))
        .slice(0, 5),
    })
  }
  return out
}
