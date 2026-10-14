import { madeToOrderMoney } from "../merchant-notifications"
import { isVacationActive } from "../../lib/merchant-settings"

const balné = { id: "b", variant_id: null, product_id: null, metadata: { packaging_fee: true } }

describe("madeToOrderMoney", () => {
  it("reports the paid deposit and what is left, ignoring the open balance collection", () => {
    const money = madeToOrderMoney({
      total: 4500,
      items: [{ id: "z", variant_id: "v", product_id: "p" }, balné],
      payment_collections: [
        {
          metadata: { made_to_order: true, production_lines: [{ line_item_id: "z" }] },
          payments: [{ amount: 1125, canceled_at: null }],
        },
        { metadata: { made_to_order_balance: true }, payments: [] },
      ],
    })
    expect(money).toEqual({ paid: 1125, total: 4500, outstanding: 3375, pureCommission: true })
  })

  it("is not a pure commission when ordinary goods were bought alongside", () => {
    const money = madeToOrderMoney({
      total: 4790,
      items: [
        { id: "z", variant_id: "v", product_id: "p" },
        { id: "o", variant_id: "v2", product_id: "p2" },
      ],
      payment_collections: [
        {
          metadata: { made_to_order: true, production_lines: [{ line_item_id: "z" }] },
          payments: [{ amount: 1565 }, { amount: 999, canceled_at: "2026-10-14" }],
        },
      ],
    })
    expect(money).toMatchObject({ paid: 1565, outstanding: 3225, pureCommission: false })
  })
})

describe("isVacationActive", () => {
  const at = (iso: string) => new Date(iso)

  it("is off when the switch is off", () => {
    expect(isVacationActive({ vacation_enabled: false, vacation_until: "2099-01-01" })).toBe(false)
  })

  it("lasts until the day before the return date (Prague time)", () => {
    const settings = { vacation_enabled: true, vacation_until: "2026-08-16" }
    expect(isVacationActive(settings, at("2026-08-15T21:30:00Z"))).toBe(true) // 15. 8. 23:30 v Praze
    expect(isVacationActive(settings, at("2026-08-15T22:30:00Z"))).toBe(false) // 16. 8. 0:30 v Praze
    expect(isVacationActive(settings, at("2026-08-15T12:00:00Z"))).toBe(true)
    expect(isVacationActive(settings, at("2026-10-14T10:00:00Z"))).toBe(false)
  })

  it("without a return date stays on until switched off", () => {
    expect(isVacationActive({ vacation_enabled: true, vacation_until: "" })).toBe(true)
  })
})
