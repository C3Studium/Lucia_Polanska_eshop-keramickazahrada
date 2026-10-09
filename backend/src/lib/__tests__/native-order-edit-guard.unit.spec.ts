import {
  editEmptiesOrder,
  pickOpenOrderChange,
} from "../native-order-edit-guard"

/**
 * Čistá část stráže nativních order-edit endpointů. Dvě chyby, které tu byly:
 * stráž hledala `order_change` podle `id = :id`, ale `:id` je ID objednávky
 * (nikdy nic nenašla → vždy pustila dál); a množství z náhledu četla jen
 * přes `.value`, takže BigNumber instance (`numeric_`) počítala jako 0.
 */
describe("pickOpenOrderChange", () => {
  it("vrátí otevřenou změnu (pending/requested), uzavřené ignoruje", () => {
    const open = pickOpenOrderChange([
      { id: "c1", status: "confirmed", created_at: "2026-10-01T10:00:00Z" },
      { id: "c2", status: "pending", created_at: "2026-10-09T10:00:00Z" },
      { id: "c3", status: "declined", created_at: "2026-10-05T10:00:00Z" },
    ])
    expect(open?.id).toBe("c2")
    expect(
      pickOpenOrderChange([{ id: "c4", status: "requested" }])?.id
    ).toBe("c4")
  })

  it("nic otevřeného = null (stráž nemá co hlídat)", () => {
    expect(pickOpenOrderChange([])).toBeNull()
    expect(pickOpenOrderChange(null)).toBeNull()
    expect(
      pickOpenOrderChange([{ id: "c1", status: "confirmed" }, { id: "c2", status: "canceled" }])
    ).toBeNull()
  })

  it("při více otevřených vyhrává nejnovější, pak vyšší verze", () => {
    expect(
      pickOpenOrderChange([
        { id: "old", status: "pending", created_at: "2026-10-01T10:00:00Z" },
        { id: "new", status: "requested", created_at: "2026-10-09T10:00:00Z" },
      ])?.id
    ).toBe("new")
    expect(
      pickOpenOrderChange([
        { id: "v2", status: "pending", version: 2 },
        { id: "v3", status: "pending", version: { value: "3" } },
      ])?.id
    ).toBe("v3")
  })
})

describe("editEmptiesOrder", () => {
  it("náhled s nulovým množstvím všech položek = vyprázdnění", () => {
    expect(editEmptiesOrder([{ quantity: 0 }, { quantity: 0 }])).toBe(true)
  })

  it("BigNumber podoby se počítají jako kusy, ne jako nula", () => {
    // Instance BigNumber z modulu nese `numeric_`; `{ value }` je graf.
    expect(editEmptiesOrder([{ quantity: { numeric_: 1 } }, { quantity: 0 }])).toBe(false)
    expect(editEmptiesOrder([{ quantity: { value: "2", precision: 20 } }])).toBe(false)
    expect(editEmptiesOrder([{ quantity: "1" }])).toBe(false)
    expect(editEmptiesOrder([{ quantity: { value: "0" } }, { quantity: { numeric_: 0 } }])).toBe(true)
  })

  it("náhled bez položek není vyprázdnění (není co hlídat)", () => {
    expect(editEmptiesOrder([])).toBe(false)
    expect(editEmptiesOrder(null)).toBe(false)
    expect(editEmptiesOrder(undefined)).toBe(false)
  })
})
