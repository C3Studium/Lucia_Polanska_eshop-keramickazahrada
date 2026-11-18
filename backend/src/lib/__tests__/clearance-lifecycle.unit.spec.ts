import { holdBlocks, CART_HOLD_MINUTES, newHold } from "../clearance-hold"
import { soldClearanceVerdict } from "../clearance-lifecycle"

describe("poškozený kus — rezervace v košíku", () => {
  const now = new Date("2026-11-18T12:00:00Z")

  it("drží 30 minut od přidání", () => {
    expect(CART_HOLD_MINUTES).toBe(30)
    expect(newHold("cart_A", "variant_1", now)).toEqual({
      cart_id: "cart_A",
      variant_id: "variant_1",
      until: "2026-11-18T12:30:00.000Z",
    })
  })

  it("cizí platná rezervace blokuje", () => {
    const hold = newHold("cart_A", "v1", now)
    expect(holdBlocks(hold, "cart_B", new Date("2026-11-18T12:29:00Z"))).toBe(true)
  })

  it("vlastní, prošlá ani žádná rezervace neblokuje", () => {
    const hold = newHold("cart_A", "v1", now)
    expect(holdBlocks(hold, "cart_A", now)).toBe(false)
    expect(holdBlocks(hold, "cart_B", new Date("2026-11-18T12:30:01Z"))).toBe(false)
    expect(holdBlocks(null, "cart_B", now)).toBe(false)
    expect(holdBlocks({ cart_id: "x" } as any, "cart_B", now)).toBe(false)
  })
})

describe("poškozený kus — po objednávce", () => {
  it("čeká, dokud není odesláno", () => {
    expect(soldClearanceVerdict({ status: "pending", fulfillments: [] })).toBe("wait")
    expect(
      soldClearanceVerdict({ status: "pending", fulfillments: [{ shipped_at: null }] })
    ).toBe("wait")
  })

  it("odesláno, předáno nebo dokončeno = smazat", () => {
    expect(
      soldClearanceVerdict({ status: "pending", fulfillments: [{ shipped_at: "2026-11-18" }] })
    ).toBe("delete")
    expect(
      soldClearanceVerdict({ status: "pending", fulfillments: [{ delivered_at: "2026-11-18" }] })
    ).toBe("delete")
    expect(soldClearanceVerdict({ status: "completed", fulfillments: [] })).toBe("delete")
  })

  it("zrušené odeslání se nepočítá", () => {
    expect(
      soldClearanceVerdict({
        status: "pending",
        fulfillments: [{ shipped_at: "2026-11-18", canceled_at: "2026-11-18" }],
      })
    ).toBe("wait")
  })

  it("zrušená objednávka = vrátit do obchodu", () => {
    expect(soldClearanceVerdict({ status: "canceled", fulfillments: [] })).toBe("restore")
  })

  it("chybějící objednávka = vrátit do obchodu", () => {
    expect(soldClearanceVerdict(null)).toBe("restore")
  })
})
