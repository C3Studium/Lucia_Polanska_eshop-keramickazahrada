import { buildCommissionSettlementItems } from "../utils"

/** Vyúčtovací (doplatková) faktura zakázky — #50 ze 14. 10. 2026. */
describe("buildCommissionSettlementItems", () => {
  const order = {
    id: "order_50",
    display_id: 50,
    total: 4500,
    shipping_total: 150,
    items: [
      { id: "z", title: "Standardní", product_title: "Pán lesa Dub", variant_id: "v", product_id: "p", quantity: 1, total: 4300 },
      {
        id: "b",
        title: "Balné",
        variant_id: null,
        product_id: null,
        quantity: 1,
        total: 50,
        metadata: { packaging_fee: true, packaging_variant_id: "v", packaging_product_id: "p" },
      },
    ],
    shipping_methods: [{ name: "Česká Pošta - Křehké" }],
  }

  const lines = buildCommissionSettlementItems(
    order as any,
    { label: "zakázka č. 50", surcharge: 400, depositPaid: 1125, depositInvoiceNumber: "20260036", balancePaid: 3775 },
    false
  )
  const total = (items: typeof lines) =>
    Math.round(items.reduce((sum, line) => sum + line.UnitPrice * line.Amount, 0) * 100) / 100

  it("má celou zakázku, příplatek a odečet zálohy s číslem faktury", () => {
    const names = lines.map((line) => line.Name)
    expect(names[0]).toBe("Pán lesa Dub")
    expect(names).toEqual(
      expect.arrayContaining([
        "Poštovné — Česká Pošta - Křehké",
        "Příplatek — zakázka č. 50",
        "Odečet zálohy — faktura č. 20260036",
      ])
    )
    expect(lines.find((line) => line.Name.startsWith("Odečet"))?.UnitPrice).toBe(-1125)
  })

  it("k úhradě vyjde přesně zaplacený doplatek, bez vyrovnání", () => {
    expect(total(lines)).toBe(3775)
    expect(lines.some((line) => line.Name === "Vyrovnání")).toBe(false)
  })

  it("jiná zaplacená částka se srovná řádkem Vyrovnání", () => {
    const odd = buildCommissionSettlementItems(
      order as any,
      { label: "zakázka č. 50", surcharge: 400, depositPaid: 1125, balancePaid: 3700 },
      false
    )
    expect(total(odd)).toBe(3700)
    expect(odd.find((line) => line.Name === "Vyrovnání")?.UnitPrice).toBe(-75)
    expect(odd.find((line) => line.Name.startsWith("Odečet"))?.Name).toBe("Odečet zaplacené zálohy")
  })
})
