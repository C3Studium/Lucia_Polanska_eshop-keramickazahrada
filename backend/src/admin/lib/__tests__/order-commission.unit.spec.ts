import { maZakazkovouPolozku } from "../order-commission"

/**
 * Rozhoduje o jediné věci: jestli u objednávky ohlásit, že se karta zakázky
 * nenačetla. U běžné objednávky se karta nekreslí vůbec, takže hláška by tam
 * byla jen strašák.
 */
describe("zakázka na objednávce", () => {
  it("pozná razítko na položce", () => {
    expect(
      maZakazkovouPolozku({
        items: [{ metadata: null }, { metadata: { made_to_order: true } }],
      })
    ).toBe(true)
  })

  it("běžná objednávka žádnou zakázku nemá", () => {
    expect(maZakazkovouPolozku({ items: [{ metadata: { balne: true } }] })).toBe(
      false
    )
  })

  it("objednávka bez položek nespadne", () => {
    expect(maZakazkovouPolozku({})).toBe(false)
    expect(maZakazkovouPolozku({ items: null })).toBe(false)
    expect(maZakazkovouPolozku({ items: [null] })).toBe(false)
  })
})
