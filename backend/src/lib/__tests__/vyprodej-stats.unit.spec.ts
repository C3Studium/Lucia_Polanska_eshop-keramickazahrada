import { computeVyprodejStats } from "../vyprodej-stats"

const order = (id: string, created_at: string, items: any[], status = "pending") => ({
  id,
  created_at,
  status,
  items,
})
const item = (product_id: string, unit: number, compare: number | null, quantity = 1, title = product_id) => ({
  product_id,
  title,
  unit_price: unit,
  compare_at_unit_price: compare,
  quantity,
})

const vyprodej = {
  id: "v1",
  start: "2026-11-10T00:00:00Z",
  end: "2026-11-20T00:00:00Z",
  productIds: ["a", "b"],
}

describe("statistiky výprodeje", () => {
  it("počítá jen zlevněné kusy výprodeje v jeho období", () => {
    const stats = computeVyprodejStats(
      [vyprodej],
      [
        order("o1", "2026-11-12T10:00:00Z", [item("a", 800, 1000, 2), item("x", 300, 400)]),
        order("o2", "2026-11-13T10:00:00Z", [item("b", 400, 500), item("a", 1000, null)]),
        order("o3", "2026-11-09T10:00:00Z", [item("a", 800, 1000)]), // před začátkem
        order("o4", "2026-11-21T10:00:00Z", [item("a", 800, 1000)]), // po konci
        order("o5", "2026-11-14T10:00:00Z", [item("a", 800, 1000)], "canceled"),
      ]
    )
    expect(stats.get("v1")).toEqual({
      orders: 2,
      units: 3,
      revenue: 2000,
      saved: 500,
      top: [
        { product_id: "a", title: "a", units: 2 },
        { product_id: "b", title: "b", units: 1 },
      ],
    })
  })

  it("bez konce počítá až do teď; prázdný výprodej má nuly", () => {
    const stats = computeVyprodejStats(
      [{ ...vyprodej, end: null }, { id: "v2", start: "2026-11-01T00:00:00Z", end: null, productIds: ["z"] }],
      [order("o1", "2026-11-25T10:00:00Z", [item("a", 800, 1000)])],
      new Date("2026-11-30T00:00:00Z")
    )
    expect(stats.get("v1")?.units).toBe(1)
    expect(stats.get("v2")).toEqual({ orders: 0, units: 0, revenue: 0, saved: 0, top: [] })
  })
})
