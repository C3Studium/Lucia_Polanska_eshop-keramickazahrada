import { bezCitlivych, teloProDenik } from "../redakce"

/**
 * Redakce těl. Tohle je ten test, který musí být nejpřísnější: deník drží
 * těla třicet dní a posílá je v alarmech e-mailem, takže jedno prosáklé pole
 * znamená heslo zákazníka v cizí poštovní schránce.
 */

const jako = (hodnota: unknown): string => JSON.stringify(hodnota)

describe("redakce podle názvu pole", () => {
  it("hesla, tokeny a platební údaje se nikdy neuloží", () => {
    const vysledek = jako(
      bezCitlivych({
        email: "jana@example.com",
        password: "velmiTajne123",
        heslo: "jinak",
        api_key: "abc",
        authorization: "Bearer xyz",
        card_number: "4111111111111117",
        cvv: "123",
        iban: "CZ6508000000192000145399",
        signature: "sha256=deadbeef",
      })
    )

    for (const tajne of [
      "velmiTajne123",
      "jinak",
      "abc",
      "xyz",
      "4111111111111117",
      "123",
      "192000145399",
      "deadbeef",
    ]) {
      expect(vysledek).not.toContain(tajne)
    }

    /* Co tajné není, zůstat musí — jinak je deník na dohledání chyby k ničemu. */
    expect(vysledek).toContain("jana@example.com")
  })

  it("skryje i vnořené a v polích", () => {
    const vysledek = jako(
      bezCitlivych({
        zakaznik: { kontakt: { password: "tajne" } },
        platby: [{ card: "4111111111111117" }],
      })
    )
    expect(vysledek).not.toContain("tajne")
    expect(vysledek).not.toContain("4111111111111117")
  })
})

describe("redakce podle tvaru hodnoty", () => {
  it("JWT se skryje, i když se pole jmenuje nevinně", () => {
    const token =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const vysledek = jako(bezCitlivych({ poznamka: token }))
    expect(vysledek).not.toContain("eyJhbGciOiJIUzI1NiJ9")
  })

  it("číslo karty se skryje i v poli, které se jmenuje poznamka", () => {
    expect(jako(bezCitlivych({ poznamka: "4111 1111 1111 1117" }))).not.toContain(
      "4111"
    )
  })

  it("obyčejný text se neskrývá", () => {
    expect(jako(bezCitlivych({ poznamka: "prosím zabalit do bublinek" }))).toContain(
      "bublinek"
    )
  })
})

describe("stropy", () => {
  it("dlouhý text se zkrátí, ne zahodí", () => {
    const vysledek = bezCitlivych({ popis: "a".repeat(2000) }) as Record<
      string,
      string
    >
    expect(vysledek.popis.length).toBeLessThan(600)
    expect(vysledek.popis).toContain("2000 znaků")
  })

  it("dlouhé pole se zkrátí a řekne, kolik položek zbylo", () => {
    const vysledek = teloProDenik({
      polozky: Array.from({ length: 500 }, (_, i) => ({ nazev: `výrobek ${i}` })),
    }) as Record<string, unknown[]>

    expect(vysledek.polozky).toHaveLength(21)
    expect(JSON.stringify(vysledek)).toContain("a dalších 480")
  })

  it("objekt s tisíci polí se zkrátí, strop velikosti tedy drží", () => {
    const siroky: Record<string, string> = {}
    for (let i = 0; i < 2000; i += 1) siroky[`pole${i}`] = `hodnota ${i}`

    const jako = JSON.stringify(teloProDenik(siroky))
    expect(jako).toContain("a dalších 1950 polí")
    /* To je ten skutečný závazek: cokoli jde do deníku a do e-mailu,
       musí být malé. */
    expect(jako.length).toBeLessThan(4000)
  })

  it("prázdné tělo je null, aby deník nelhal, že něco přišlo", () => {
    expect(teloProDenik({})).toBeNull()
    expect(teloProDenik(undefined)).toBeNull()
    expect(teloProDenik(null)).toBeNull()
  })

  it("cyklická struktura deník neshodí", () => {
    const cyklus: Record<string, unknown> = { a: 1 }
    cyklus.sam = cyklus
    expect(() => teloProDenik(cyklus)).not.toThrow()
  })
})
