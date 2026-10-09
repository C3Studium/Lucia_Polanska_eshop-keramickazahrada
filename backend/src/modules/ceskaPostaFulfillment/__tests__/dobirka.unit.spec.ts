import { rozhodniDobirku } from "../dobirka"

/**
 * Rozhodnutí o dobírce z razítka `stampDobirkaStep` — především tvrdá
 * zastávka: objednávka na dobírku bez částky se NEPODÁVÁ (dřív se tiše
 * podala bez dobírky = zboží pryč, peníze nikde).
 */
describe("rozhodniDobirku", () => {
  it("dobírka s částkou → vybrat zaokrouhleně", () => {
    expect(
      rozhodniDobirku({ cp_dobirka_zjistena: true, cp_dobirka: true, cp_dobirka_czk: 1250.4 })
    ).toEqual({ ok: true, dobirka: { castka: 1250 }, varovani: null })
  })

  it("karta (cp_dobirka: false, částka 0) → bez dobírky, bez chyby", () => {
    expect(
      rozhodniDobirku({ cp_dobirka_zjistena: true, cp_dobirka: false, cp_dobirka_czk: 0 })
    ).toEqual({ ok: true, dobirka: null, varovani: null })
  })

  it("TVRDÁ ZASTÁVKA: dobírka bez částky / s nulou / s nesmyslem se nepodává", () => {
    for (const castka of [0, -5, null, undefined, "abc", NaN]) {
      const vysledek = rozhodniDobirku({
        cp_dobirka_zjistena: true,
        cp_dobirka: true,
        cp_dobirka_czk: castka,
      })
      expect(vysledek.ok).toBe(false)
      if (!vysledek.ok) {
        expect(vysledek.duvod).toMatch(/NEPODALA/)
        expect(vysledek.duvod).toMatch(/dobírku/)
      }
    }
  })

  it("chybějící razítko → bez dobírky s varováním (objednávka přišla jinudy)", () => {
    const vysledek = rozhodniDobirku({})
    expect(vysledek.ok).toBe(true)
    if (vysledek.ok) {
      expect(vysledek.dobirka).toBeNull()
      expect(vysledek.varovani).toMatch(/cp_dobirka_zjistena/)
    }
    expect(rozhodniDobirku(null).ok).toBe(true)
  })

  it("staré razítko bez cp_dobirka: částka rozhoduje jako dřív", () => {
    expect(rozhodniDobirku({ cp_dobirka_zjistena: true, cp_dobirka_czk: 890 })).toEqual({
      ok: true,
      dobirka: { castka: 890 },
      varovani: null,
    })
    expect(rozhodniDobirku({ cp_dobirka_zjistena: true, cp_dobirka_czk: 0 })).toEqual({
      ok: true,
      dobirka: null,
      varovani: null,
    })
  })

  it("částka jako BigNumber objekt se čte", () => {
    expect(
      rozhodniDobirku({
        cp_dobirka_zjistena: true,
        cp_dobirka: true,
        cp_dobirka_czk: { value: "1890", precision: 20 },
      })
    ).toEqual({ ok: true, dobirka: { castka: 1890 }, varovani: null })
  })
})
