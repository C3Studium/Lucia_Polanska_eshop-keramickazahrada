import { vetaMesice } from "../lib/veta-mesice"

const fmt = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`

describe("vetaMesice — statistiky jednou větou", () => {
  it("víc než minule", () => {
    expect(
      vetaMesice([{ orders: 9, revenue: 12100 }, { orders: 12, revenue: 18400 }], fmt)
    ).toBe("Tento měsíc 12 objednávek za 18 400 Kč — o 3 víc než minulý měsíc.")
  })
  it("méně a jednotné číslo", () => {
    expect(vetaMesice([{ orders: 3, revenue: 900 }, { orders: 1, revenue: 490 }], fmt)).toBe(
      "Tento měsíc 1 objednávka za 490 Kč — o 2 méně než minulý měsíc."
    )
  })
  it("stejně a 2–4 objednávky", () => {
    expect(vetaMesice([{ orders: 2, revenue: 100 }, { orders: 2, revenue: 300 }], fmt)).toBe(
      "Tento měsíc 2 objednávky za 300 Kč — stejně jako minulý měsíc."
    )
  })
  it("zatím nic / bez dat", () => {
    expect(vetaMesice([{ orders: 4, revenue: 100 }, { orders: 0, revenue: 0 }], fmt)).toBe(
      "Tento měsíc zatím žádná objednávka (minulý měsíc 4)."
    )
    expect(vetaMesice([], fmt)).toBeNull()
  })
})
