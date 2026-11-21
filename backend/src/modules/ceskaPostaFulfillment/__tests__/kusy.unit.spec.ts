/**
 * Víc balíků na jednu adresu — „vícekusová zásilka" (21. 11. 2026).
 *
 * Ověřeno v testovacím prostředí ČP (b2b-test, 21. 11. 2026):
 * - jedno podání `parcelService` s `multipartParcelData` vrátí číslo pro
 *   každý kus a JEDNO PDF se stránkou na kus („1/2", „2/2", velikost a váha
 *   každého kusu, dobírka jen na prvním);
 * - Balíkovna (NB) víc kusů tiše zahodí — vrátí jedno číslo. Proto jen DR.
 */
import {
  MAX_KUSU,
  pocetKusu,
  prectiOdpoved,
  rozdelVahu,
  sestavPodani,
  sluzbyProZasilku,
  velikostPodleTrid,
  type VstupPodani,
} from "../parcel"

const ODESILATEL = { customerId: "U124", postCode: "10003", locationNumber: 195 }

const vstup = (prepsat: Partial<VstupPodani> = {}): VstupPodani => ({
  serviceCode: "DR",
  vaha: 4,
  prijemce: {
    first_name: "Jan",
    last_name: "Novák",
    address_1: "Těšínská 2672/42",
    city: "Opava",
    postal_code: "746 01",
    phone: "603 123 456",
  },
  email: "jan.novak@email.cz",
  odesilatel: ODESILATEL,
  sluzby: ["7", "M"],
  velikost: "M",
  datum: "2026-11-21",
  ...prepsat,
})

describe("automatická velikost podle výrobků", () => {
  it("jen malé výrobky = S, aspoň jeden velký = M", () => {
    expect(velikostPodleTrid(["male", "male"])).toBe("S")
    expect(velikostPodleTrid(["male", "velke"])).toBe("M")
    expect(velikostPodleTrid([])).toBe("S")
  })
})

describe("počet balíků", () => {
  it("jen 1–5, celá čísla, a jen na adresu", () => {
    expect(pocetKusu(2, "DR")).toBe(2)
    expect(pocetKusu("3", "DR")).toBe(3)
    expect(pocetKusu(9, "DR")).toBe(MAX_KUSU)
    expect(pocetKusu(0, "DR")).toBe(1)
    expect(pocetKusu("nesmysl", "DR")).toBe(1)
    expect(pocetKusu(3, "NB")).toBe(1)
  })
})

describe("rozdělení hmotnosti", () => {
  it("rovným dílem, součet sedí na gramy", () => {
    expect(rozdelVahu(4, 2)).toEqual([2, 2])
    const tri = rozdelVahu(1, 3)
    expect(tri.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3)
    expect(tri.every((v) => v >= 0.1)).toBe(true)
  })
  it("žádný kus pod 0,1 kg (ČP nulovou váhu nebere)", () => {
    expect(rozdelVahu(0.1, 3).every((v) => v >= 0.1)).toBe(true)
  })
})

describe("podání víc balíků", () => {
  it("jeden balík = beze změny (žádná služba 70, žádné další kusy)", () => {
    const telo: any = sestavPodani(vstup())
    expect(telo.multipartParcelData).toBeUndefined()
    expect(telo.parcelServiceData.parcelServices).not.toContain("70")
    expect(telo.parcelServiceData.parcelParams.sequenceParcel).toBeUndefined()
  })

  it("dva balíky: hlavní 1/2 + druhý 2/2, služba 70, váha rozdělená, velikost na obou", () => {
    const telo: any = sestavPodani(vstup({ pocetKusu: 2 }))
    const hlavni = telo.parcelServiceData
    expect(hlavni.parcelParams).toMatchObject({ sequenceParcel: 1, quantityParcel: 2, weight: "2" })
    expect(hlavni.parcelServices).toEqual(["7", "M", "70"])
    expect(telo.multipartParcelData).toEqual([
      {
        addParcelData: { recordID: "2", prefixParcelCode: "DR", weight: "2", sequenceParcel: 2, quantityParcel: 2 },
        addParcelDataServices: ["70", "M"],
      },
    ])
  })

  it("dobírka a udaná cena jen na hlavním balíku; křehké na všech", () => {
    const telo: any = sestavPodani(
      vstup({
        pocetKusu: 2,
        sluzby: sluzbyProZasilku({ serviceCode: "DR", krehke: true, maDobirku: true, velikost: "S" }),
        velikost: "S",
        dobirka: { castka: 1500, variabilniSymbol: "0000000088" },
        udanaCena: 1500,
      })
    )
    expect(telo.parcelServiceData.parcelParams.amount).toBe(1500)
    expect(telo.multipartParcelData[0].addParcelData.amount).toBeUndefined()
    expect(telo.multipartParcelData[0].addParcelDataServices).toEqual(["70", "S", "11"])
  })

  it("Balíkovna zůstane jedním balíkem i s požadavkem na víc", () => {
    const telo: any = sestavPodani(
      vstup({ serviceCode: "NB", pocetKusu: 3, sluzby: ["7"], vydejna: { zip: "10000" } as any })
    )
    expect(telo.multipartParcelData).toBeUndefined()
  })
})

describe("odpověď s víc kusy", () => {
  it("vrátí čísla všech balíků v pořadí", () => {
    const vysledek = prectiOdpoved({
      responseHeader: {
        resultHeader: { responseCode: 1, responseText: "OK" },
        resultParcelData: [
          { recordNumber: "1", parcelCode: "DR1241120492U", parcelStateResponse: [{ responseCode: 408, responseText: "INFO_ADDRESS_WAS_MODIFIED" }] },
          { recordNumber: "2", parcelCode: "DR1241120501U", parcelStateResponse: [{ responseCode: 1, responseText: "OK" }] },
        ],
        responsePrintParams: { file: "JVBERi0=" },
      },
    })
    expect(vysledek.ok).toBe(true)
    expect(vysledek.cisloZasilky).toBe("DR1241120492U")
    expect(vysledek.cislaZasilek).toEqual(["DR1241120492U", "DR1241120501U"])
  })

  it("chyba u druhého kusu = odmítnuté podání", () => {
    const vysledek = prectiOdpoved({
      responseHeader: {
        resultHeader: { responseCode: 19, responseText: "BATCH_INVALID" },
        resultParcelData: [
          { parcelCode: "DR1", parcelStateResponse: [{ responseCode: 1, responseText: "OK" }] },
          { parcelCode: "", parcelStateResponse: [{ responseCode: 261, responseText: "MISSING_SIZE_CATEGORY" }] },
        ],
      },
    })
    expect(vysledek.ok).toBe(false)
    expect(vysledek.chyby.join(" ")).toContain("261")
  })
})
