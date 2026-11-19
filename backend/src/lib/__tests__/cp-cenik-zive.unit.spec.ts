import { rozdilCeniku, stahniCenikCp, stahniZemi } from "../cp-kalkulacka/zive"
import { cpCheapest, cpShipsTo } from "../cp-kalkulacka"
import { internationalQuoteFor } from "../international-shipping-price"

const PRIO = "Standardní balík do zahraničí - prioritní"
const EKO = "Standardní balík do zahraničí - ekonomický"
const EMS = "EMS do zahraničí"

/* Podvržená kalkulačka ČP: váhy 1 a 3 kg, ceny podle váhy. */
const kalkulacka = (opts: { selze?: string[]; nic?: string[] } = {}) =>
  jest.fn(async (url: string) => {
    const u = String(url)
    const country = (u.match(/targetCountry(?:=|%22%3A%22)([A-Z]{2})/) ?? [])[1] ?? ""
    const json = (body: unknown, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify(body) })
    if (opts.selze?.includes(country)) return { ok: false, status: 403, text: async () => "<html>Access denied</html>" }
    if (u.includes("resource_id=weights")) return json({ "1.0": "do 1 kg", "3.0": "do 3 kg" })
    const vaha = Number(decodeURIComponent(u).match(/"weight":"([0-9.]+)"/)?.[1])
    if (opts.nic?.includes(country) && vaha > 1) {
      return json({ error: [{ value: "Vašemu zadání neodpovídá žádný z produktů České pošty!" }], validation: false }, 400)
    }
    return json({
      parcelProducts: [
        { productName: PRIO, roundedPriceWithVat: vaha === 1 ? 400 : 480 },
        { productName: EKO, roundedPriceWithVat: vaha === 1 ? 350 : 440 },
      ],
      expressProducts: [{ productName: EMS, roundedPriceWithVat: 1000 + vaha }],
    })
  }) as unknown as typeof fetch

const rychle = { pauza: [0, 0] as [number, number], pokusy: 1 }

describe("stažení ceníku ČP z kalkulačky", () => {
  it("stáhne všechny váhy a služby (balíky i EMS) se stejnými dotazy jako web", async () => {
    const fetchFn = kalkulacka()
    const data = await stahniZemi("de", { ...rychle, fetchFn })
    expect(data[PRIO]).toEqual([[1, 400], [3, 480]])
    expect(data[EKO]).toEqual([[1, 350], [3, 440]])
    expect(data[EMS]).toEqual([[1, 1001], [3, 1003]])
    expect((fetchFn as any).mock.calls).toHaveLength(3) // weights + 2 váhy
  })

  it("„žádný produkt“ u váhy není chyba — ta váha tam prostě nejede", async () => {
    const data = await stahniZemi("sk", { ...rychle, fetchFn: kalkulacka({ nic: ["SK"] }) })
    expect(data[PRIO]).toEqual([[1, 400]])
  })

  it("zablokovaná země skončí v chybách, ostatní se stáhnou", async () => {
    const vysledek = await stahniCenikCp(["de", "fr"], { ...rychle, fetchFn: kalkulacka({ selze: ["FR"] }) })
    expect(Object.keys(vysledek.zeme)).toEqual(["de"])
    expect(vysledek.chyby).toEqual([{ country: "fr", chyba: expect.stringContaining("není JSON") }])
  })

  it("rozdíl cen pro e-mail", () => {
    const rozdil = rozdilCeniku({ de: { [PRIO]: [[1, 400], [3, 470]] } }, { de: { [PRIO]: [[1, 400], [3, 480]] } })
    expect(rozdil.pocet).toBe(1)
    expect(rozdil.ukazka[0]).toBe(`DE ${PRIO} do 3 kg: 470 → 480 Kč`)
  })
})

describe("výpočet ze stažených dat", () => {
  const zive = { de: { [PRIO]: [[1, 400], [3, 480]], [EKO]: [[1, 350], [3, 440]] } } as any

  it("země ve stažených datech se počítá z nich, ostatní ze zálohy", () => {
    expect(cpCheapest("de", 2, [], zive)).toMatchObject({ service: EKO, price_czk: 440, up_to_kg: 3 })
    // FR ve stažených není → záloha z 19. 11. (ekonomický do 2 kg 595 Kč… nejlevnější z tabulky)
    expect(cpCheapest("fr", 2, [], zive)?.price_czk).toBeGreaterThan(0)
    expect(cpShipsTo("de", zive)).toBe(true)
    expect(cpShipsTo("de", { de: {} } as any)).toBe(false)
  })

  it("cena v pokladně bere stažený ceník z dat volby", () => {
    const option = {
      international: true,
      countries: ["de"],
      overrides_czk: {},
      services: [],
      parcel_weight_kg: 3,
      packaging_kg: 0,
      currency_by_country: { de: "eur" },
      rates: { EUR: { amount: 1, rate: 25 } },
      rates_date: "19.11.2026",
      cenik_zive: { fetched_at: "2026-11-20T00:00:00Z", countries: zive },
    }
    expect(internationalQuoteFor(option, "de", 2.5)).toMatchObject({ price_czk: 440, amount: 17.6, service: EKO })
  })
})
