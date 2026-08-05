import { revenueForProducts, statsByCode, type OrderScanRow } from "../sale-stats"

const order = (
  id: string,
  created_at: string,
  total: number,
  items: OrderScanRow["items"]
): OrderScanRow => ({ id, created_at, total, items })

describe("statsByCode", () => {
  it("counts an order once per code even across multiple lines", () => {
    const stats = statsByCode([
      order("o1", "2026-08-01", 1000, [
        { product_id: "p1", total: 400, adjustments: [{ code: "LETO", amount: 50 }] },
        { product_id: "p2", total: 600, adjustments: [{ code: "LETO", amount: 70 }] },
      ]),
    ])
    expect(stats.get("LETO")).toEqual({
      orders: 1,
      revenue: 1000,
      discount_given: 120,
    })
  })

  it("credits each code in a mixed order with the whole basket", () => {
    // Two codes on one basket both "generated" that basket — the honest
    // reading of "kolik přinesla", and why per-code revenues must never be
    // summed into a grand total.
    const stats = statsByCode([
      order("o1", "2026-08-01", 900, [
        { product_id: "p1", total: 900, adjustments: [
          { code: "A", amount: 50 },
          { code: "B", amount: 30 },
        ]},
      ]),
    ])
    expect(stats.get("A")!.revenue).toBe(900)
    expect(stats.get("B")!.revenue).toBe(900)
  })

  it("ignores adjustments without a code (automatic line discounts)", () => {
    const stats = statsByCode([
      order("o1", "2026-08-01", 500, [
        { product_id: "p1", total: 500, adjustments: [{ code: null, amount: 25 }] },
      ]),
    ])
    expect(stats.size).toBe(0)
  })

  it("accumulates across orders with clean rounding", () => {
    const rows = [
      order("o1", "2026-08-01", 100.1, [
        { product_id: "p1", total: 100.1, adjustments: [{ code: "X", amount: 0.1 }] },
      ]),
      order("o2", "2026-08-02", 200.2, [
        { product_id: "p1", total: 200.2, adjustments: [{ code: "X", amount: 0.2 }] },
      ]),
    ]
    expect(statsByCode(rows).get("X")).toEqual({
      orders: 2,
      revenue: 300.3,
      discount_given: 0.3,
    })
  })
})

describe("revenueForProducts", () => {
  const rows = [
    order("o1", "2026-06-15", 800, [
      { product_id: "p1", total: 300, adjustments: [] },
      { product_id: "p2", total: 500, adjustments: [] },
    ]),
    order("o2", "2026-07-15", 400, [
      { product_id: "p1", total: 400, adjustments: [] },
    ]),
  ]

  it("sums line revenue, not basket totals", () => {
    const result = revenueForProducts(rows, new Set(["p1"]), null, null)
    // p1 lines: 300 + 400 — never o1's basket total of 800.
    expect(result).toEqual({ orders: 2, units_revenue: 700 })
  })

  it("respects the sale window on both edges", () => {
    const result = revenueForProducts(
      rows,
      new Set(["p1"]),
      "2026-07-01",
      "2026-07-31"
    )
    expect(result).toEqual({ orders: 1, units_revenue: 400 })
  })

  it("treats an open end as unbounded", () => {
    const result = revenueForProducts(rows, new Set(["p1"]), "2026-07-01", null)
    expect(result.orders).toBe(1)
  })

  it("returns zeros for products nobody bought", () => {
    expect(revenueForProducts(rows, new Set(["p9"]), null, null)).toEqual({
      orders: 0,
      units_revenue: 0,
    })
  })
})
