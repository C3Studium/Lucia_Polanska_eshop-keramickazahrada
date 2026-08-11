import { decideSettlement, validateEditActions } from "../order-edit-rules"

const line = (id: string, mto = false) => ({
  id, quantity: 1, is_made_to_order: mto,
})

describe("validateEditActions", () => {
  it("refuses touching a made-to-order line — call the maker instead", () => {
    const result = validateEditActions(
      [line("a", true), line("b")],
      [{ type: "swap", item_id: "a", variant_id: "v2" }]
    )
    expect(result.ok).toBe(false)
  })

  it("refuses emptying the order — editing is not cancellation", () => {
    const result = validateEditActions(
      [line("a")],
      [{ type: "remove", item_id: "a" }]
    )
    expect(result.ok).toBe(false)
  })

  it("allows removing everything when something new comes in", () => {
    const result = validateEditActions(
      [line("a")],
      [
        { type: "remove", item_id: "a" },
        { type: "add", variant_id: "v9", quantity: 1 },
      ]
    )
    expect(result.ok).toBe(true)
  })

  it("keeps MTO lines invisible to the guard when untouched", () => {
    const result = validateEditActions(
      [line("mto", true), line("b")],
      [{ type: "swap", item_id: "b", variant_id: "v2" }]
    )
    expect(result.ok).toBe(true)
  })
})

describe("decideSettlement", () => {
  it("collects before confirming when a card order gets pricier", () => {
    expect(decideSettlement(240, "card")).toEqual({ kind: "collect", amount: 240 })
  })
  it("owes a refund when a card order gets cheaper", () => {
    expect(decideSettlement(-180, "card")).toEqual({ kind: "refund_due", amount: 180 })
  })
  it("settles at handover for pickup and dobírka", () => {
    expect(decideSettlement(240, "pickup")).toEqual({ kind: "none" })
    expect(decideSettlement(-99, "dobirka")).toEqual({ kind: "none" })
  })
  it("treats a haléř as no difference", () => {
    expect(decideSettlement(0.004, "card")).toEqual({ kind: "none" })
  })
})
