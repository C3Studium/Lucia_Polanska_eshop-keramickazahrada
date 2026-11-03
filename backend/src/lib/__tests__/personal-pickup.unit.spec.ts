import { isPersonalPickupOrder } from "../personal-pickup"

/**
 * Osobní odběr se čte z dat metody dopravy. Data ale nejsou vždy čistá:
 * Medusa je při výměně dopravy slučuje, takže po přechodu z odběru na
 * zásilku v nich zůstane starý příznak. Tenhle test drží pravidlo, které
 * ten rozpor rozsoudí — jinak objednávka na poštu zase skončí v Denní práci
 * jako „Připraveno k vyzvednutí" (objednávka #69, 3. 11. 2026).
 */
const objednavka = (...data: Record<string, unknown>[]) => ({
  shipping_methods: data.map((d) => ({ data: d })),
})

describe("osobní odběr na objednávce", () => {
  it("odběr se pozná podle příznaku i podle kódu služby", () => {
    expect(isPersonalPickupOrder(objednavka({ personal_pickup: true }))).toBe(true)
    expect(isPersonalPickupOrder(objednavka({ service_code: "PICKUP" }))).toBe(true)
  })

  it("zásilka Českou poštou odběr není", () => {
    expect(isPersonalPickupOrder(objednavka({ service_code: "DR" }))).toBe(false)
    expect(isPersonalPickupOrder(objednavka({ service_code: "NB" }))).toBe(false)
  })

  it("po výměně odběru za poštu rozhodne kód dopravce, ne zbytek po odběru", () => {
    /* Přesně to, co měla v datech objednávka #69 na dev. */
    const po69 = {
      id: "cp-address",
      name: "Česká pošta – na adresu",
      fragile: true,
      service_code: "DR",
      personal_pickup: true,
    }

    expect(isPersonalPickupOrder(objednavka(po69))).toBe(false)
  })

  it("objednávka bez dopravy odběr není", () => {
    expect(isPersonalPickupOrder({ shipping_methods: [] })).toBe(false)
    expect(isPersonalPickupOrder(null)).toBe(false)
    expect(isPersonalPickupOrder(undefined)).toBe(false)
  })
})
