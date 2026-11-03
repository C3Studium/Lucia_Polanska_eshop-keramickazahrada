import { formatVoucherNote } from "../gift-voucher-orders"

/**
 * Uplatněný poukaz je v objednávce SLEVA, takže na faktuře zůstanou jen nižší
 * částky — z dokladu se nepozná, že se platilo poukazem, ani kterým. Účetní to
 * musí umět spárovat s prodejem toho poukazu, proto ta věta v popisu.
 */
/** `toLocaleString("cs-CZ")` odděluje tisíce pevnou mezerou — v testu ji srovnáme. */
const mezery = (value: string | null): string | null =>
  value === null ? null : value.replace(/[\u00a0\u202f\u2009]/g, " ")

describe("poznámka o poukazu na dokladu", () => {
  it("jeden poukaz i s částkou", () => {
    expect(
      mezery(formatVoucherNote([{ code: "UP39GY8C", amount: 2960, reversed_at: null }]))
    ).toBe("uhrazeno dárkovým poukazem UP39GY8C (2 960 Kč)")
  })

  it("víc poukazů v jedné objednávce", () => {
    expect(
      mezery(
        formatVoucherNote([
          { code: "UP39GY8C", amount: 1000, reversed_at: null },
          { code: "BBHXY4W4", amount: 500, reversed_at: null },
        ])
      )
    ).toBe("uhrazeno dárkovými poukazy UP39GY8C (1 000 Kč), BBHXY4W4 (500 Kč)")
  })

  it("vrácené uplatnění se nepočítá — ta částka se na poukaz vrátila", () => {
    expect(
      formatVoucherNote([
        { code: "UP39GY8C", amount: 1000, reversed_at: "2026-11-01T10:00:00Z" },
      ])
    ).toBeNull()
  })

  it("objednávka bez poukazu nemá co dopisovat", () => {
    expect(formatVoucherNote([])).toBeNull()
    expect(formatVoucherNote([{ code: null, amount: 100, reversed_at: null }])).toBeNull()
  })

  it("nulová částka zůstane aspoň kódem", () => {
    expect(formatVoucherNote([{ code: "ZEUTUMBG", amount: 0, reversed_at: null }])).toBe(
      "uhrazeno dárkovým poukazem ZEUTUMBG"
    )
  })
})
