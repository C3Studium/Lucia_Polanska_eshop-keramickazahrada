import { customerOrderStatus, type CustomerStatusInput } from "../order-customer-status"

const base: CustomerStatusInput = {
  canceled: false,
  merchantStage: "received",
  production: null,
  pickup: false,
  shipped: false,
  delivered: false,
  fullyRefunded: false,
  claims: [],
}
const label = (patch: Partial<CustomerStatusInput>) => customerOrderStatus({ ...base, ...patch }).label

describe("customerOrderStatus", () => {
  it("běžný postup podle Denní práce", () => {
    expect(label({})).toBe("Přijato")
    expect(label({ merchantStage: "working" })).toBe("Připravujeme")
    expect(label({ merchantStage: "shipping" })).toBe("Chystáme k odeslání")
    expect(label({ merchantStage: "shipping", pickup: true })).toBe("Připraveno k vyzvednutí")
  })

  it("#50: odesláno v Denní práci, i když dopravce ještě nezapsal odeslání", () => {
    expect(label({ merchantStage: "shipped", production: { stage: "ready_to_ship", outstanding: 0 } })).toBe(
      "Odesláno"
    )
  })

  it("doručeno a vyzvednutí", () => {
    expect(label({ delivered: true, shipped: true })).toBe("Doručeno")
    expect(label({ merchantStage: "shipped", pickup: true })).toBe("Vyzvednuto")
  })

  it("zakázka ve výrobě má přednost před Připravujeme", () => {
    expect(label({ merchantStage: "working", production: { stage: "in_production", outstanding: 3000 } })).toBe(
      "Ve výrobě"
    )
    expect(label({ production: { stage: "awaiting_balance", outstanding: 3000 } })).toBe(
      "Hotovo — čeká na doplatek"
    )
  })

  it("otevřená reklamace přebije odeslání, vyřízená ukáže výsledek", () => {
    expect(label({ shipped: true, claims: [{ kind: "reklamace", status: "pending" }] })).toBe(
      "Reklamaci posuzujeme"
    )
    expect(label({ shipped: true, claims: [{ kind: "vraceni", status: "approved" }] })).toBe("Vrácení schváleno")
    expect(
      label({ shipped: true, claims: [{ kind: "odstoupeni", status: "resolved", refund_amount: 450 }] })
    ).toBe("Vráceno — peníze vráceny")
    expect(label({ shipped: true, claims: [{ kind: "reklamace", status: "resolved" }] })).toBe(
      "Reklamace vyřízena"
    )
  })

  it("zrušená a zamítnutá žádost", () => {
    expect(label({ canceled: true, fullyRefunded: true })).toBe("Zrušeno")
    expect(label({ shipped: true, claims: [{ kind: "reklamace", status: "rejected" }] })).toBe("Odesláno")
  })
})
