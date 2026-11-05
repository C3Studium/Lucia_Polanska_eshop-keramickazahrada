import { isPickupOption, methodDataFor } from "../shipping-choice"

/**
 * Výměna dopravy u zakázky s cenou po domluvě. Rozhoduje se podle dat
 * z produkce (ověřeno 3. 11. 2026 na živém seznamu možností).
 *
 * Nejdůležitější je tu poslední blok: Medusa data metody dopravy SLUČUJE,
 * takže co nová data nejmenují, zůstane po těch starých. Na tom stála
 * objednávka #69 — vyměněná na Českou poštu, a přesto pořád „k vyzvednutí".
 */
const CESKA_POSTA_KREHKE = {
  name: "Česká Pošta - Křehké",
  provider_id: "ceska-posta-fulfillment_balikovna",
  data: { id: "cp-address", name: "Česká pošta – na adresu", service_code: "DR" },
}

const ODBER = {
  name: "Osobní odběr",
  provider_id: "pickup_osobni-odber",
  data: {
    id: "personal-pickup",
    name: "Osobní odběr v dílně",
    service_code: "PICKUP",
    personal_pickup: true,
  },
}

describe("volba dopravy u ceny po domluvě", () => {
  it("osobní odběr se pozná podle provideru, ne podle názvu", () => {
    expect(isPickupOption({ provider_id: "pickup_osobni-odber" })).toBe(true)
    expect(isPickupOption({ provider_id: "ceska-posta-fulfillment_balikovna" })).toBe(false)
    expect(isPickupOption({})).toBe(false)
    expect(isPickupOption(null)).toBe(false)
  })

  it("data možnosti se metodě předají, jak jsou", () => {
    expect(
      methodDataFor({
        name: "Balíkovna",
        provider_id: "ceska-posta-fulfillment_balikovna",
        data: { id: "balikovna", name: "Balíkovna", service_code: "NB" },
      })
    ).toEqual({
      id: "balikovna",
      name: "Balíkovna",
      service_code: "NB",
      fragile: false,
      personal_pickup: false,
    })
  })

  it("osobní odběr si nese svůj příznak — Denní práce podle něj mluví o pultu", () => {
    expect(methodDataFor(ODBER)).toMatchObject({ personal_pickup: true, fragile: false })
  })

  it("křehká zásilka dostane příznak, i když ho data možnosti nemají (živý stav)", () => {
    expect(methodDataFor(CESKA_POSTA_KREHKE)).toEqual({
      id: "cp-address",
      name: "Česká pošta – na adresu",
      service_code: "DR",
      fragile: true,
      personal_pickup: false,
    })
  })

  it("obyčejná Česká pošta křehká není", () => {
    expect(
      methodDataFor({
        name: "Česká Pošta",
        provider_id: "ceska-posta-fulfillment_balikovna",
        data: { service_code: "DR" },
      })
    ).toEqual({ service_code: "DR", fragile: false, personal_pickup: false })
  })

  it("možnost bez dat nespadne", () => {
    expect(
      methodDataFor({ name: "Česká pošta – křehké", provider_id: "ceska-posta-fulfillment_balikovna" })
    ).toEqual({ fragile: true, personal_pickup: false })
    expect(methodDataFor({})).toEqual({ fragile: false, personal_pickup: false })
  })

  it("bez provideru rozhodnou data možnosti, ne mlčení", () => {
    expect(methodDataFor({ name: "Osobní odběr", data: { personal_pickup: true } })).toMatchObject({
      personal_pickup: true,
    })
  })
})

/**
 * Slučování dat: objednávka vznikla na osobní odběr a majitelka vybrala
 * Českou poštu. Tahle simulace dělá to, co Medusa — staré klíče nechá žít —
 * a musí z ní vyjít zásilka, ne odběr.
 */
describe("výměna odběru za zásilku nenechá za sebou příznak odběru", () => {
  const poSlouceni = (puvodni: Record<string, unknown>, nova: Record<string, unknown>) => ({
    ...puvodni,
    ...nova,
  })

  it("z osobního odběru na Českou poštu — Denní práce už nemluví o pultu", () => {
    const vysledek = poSlouceni(ODBER.data, methodDataFor(CESKA_POSTA_KREHKE))

    expect(vysledek.personal_pickup).toBe(false)
    expect(vysledek.service_code).toBe("DR")
    expect(vysledek.fragile).toBe(true)
  })

  it("a zpátky na odběr se zásilka nedrží", () => {
    const vysledek = poSlouceni(
      poSlouceni(ODBER.data, methodDataFor(CESKA_POSTA_KREHKE)),
      methodDataFor(ODBER)
    )

    expect(vysledek.personal_pickup).toBe(true)
    expect(vysledek.fragile).toBe(false)
    expect(vysledek.service_code).toBe("PICKUP")
  })
})
