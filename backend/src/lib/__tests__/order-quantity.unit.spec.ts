import { toNumber as refundRulesToNumber } from "../claims/refund-rules"
import {
  LINE_QUANTITY_FIELDS,
  lineQuantityOf,
  toNumber,
} from "../order-quantity"

/**
 * Množství řádku objednávky z `query.graph` — tvar změřený 9. 10. 2026 na #36:
 * při výslovném výběru `items.quantity` položka klíč `quantity` NEMÁ, množství
 * je jen na `detail` (číslo) a `detail.raw_quantity` (objekt BigNumber).
 */
describe("lineQuantityOf", () => {
  it("#36 (změřeno): položka bez quantity, množství jen na detail", () => {
    expect(
      lineQuantityOf({
        detail: { quantity: 1, raw_quantity: { value: "1", precision: 20 } },
      })
    ).toBe(1)
    expect(lineQuantityOf({ detail: { raw_quantity: { value: "3", precision: 20 } } })).toBe(3)
  })

  it("items.* projekce: číslo na řádku vyhrává", () => {
    expect(lineQuantityOf({ quantity: 2, detail: { quantity: 99 } })).toBe(2)
    expect(lineQuantityOf({ quantity: "4" })).toBe(4)
  })

  it("BigNumber podoby — {value}, {numeric_}, raw_quantity", () => {
    expect(lineQuantityOf({ quantity: { value: "5", precision: 20 } })).toBe(5)
    expect(lineQuantityOf({ quantity: { numeric_: 6 } })).toBe(6)
    expect(lineQuantityOf({ raw_quantity: { value: "7" } })).toBe(7)
  })

  it("pořadí: quantity → raw_quantity → detail.quantity → detail.raw_quantity", () => {
    expect(
      lineQuantityOf({
        quantity: 0,
        raw_quantity: { value: "0" },
        detail: { quantity: 0, raw_quantity: { value: "2" } },
      })
    ).toBe(2)
    expect(lineQuantityOf({ quantity: 0, raw_quantity: { value: "8" }, detail: { quantity: 1 } })).toBe(8)
  })

  it("nic k přečtení = 0, ne NaN", () => {
    expect(lineQuantityOf({})).toBe(0)
    expect(lineQuantityOf(null)).toBe(0)
    expect(lineQuantityOf(undefined)).toBe(0)
    expect(lineQuantityOf({ quantity: "abc", detail: null })).toBe(0)
    expect(Number.isNaN(lineQuantityOf({ quantity: NaN }))).toBe(false)
  })

  it("re-exportuje sdílený toNumber (jedna funkce pro celý backend)", () => {
    expect(toNumber).toBe(refundRulesToNumber)
    expect(toNumber({ value: "12.5" })).toBe(12.5)
  })

  it("LINE_QUANTITY_FIELDS kryje řádek i detail, číslo i raw", () => {
    expect(LINE_QUANTITY_FIELDS).toEqual([
      "items.quantity",
      "items.raw_quantity",
      "items.detail.quantity",
      "items.detail.raw_quantity",
    ])
  })
})
