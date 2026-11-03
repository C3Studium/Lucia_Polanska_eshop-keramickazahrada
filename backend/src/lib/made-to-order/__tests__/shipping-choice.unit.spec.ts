import { isPickupOption, methodDataFor } from "../shipping-choice"

/**
 * Výměna dopravy u zakázky s cenou po domluvě. Rozhoduje se podle dat
 * z produkce (ověřeno 3. 11. 2026 na živém seznamu možností).
 */
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
        data: { id: "balikovna", name: "Balíkovna", service_code: "NB" },
      })
    ).toEqual({ id: "balikovna", name: "Balíkovna", service_code: "NB" })
  })

  it("osobní odběr si nese svůj příznak — Denní práce podle něj mluví o pultu", () => {
    expect(
      methodDataFor({
        name: "Osobní odběr",
        data: { id: "personal-pickup", service_code: "PICKUP", personal_pickup: true },
      })
    ).toEqual({ id: "personal-pickup", service_code: "PICKUP", personal_pickup: true })
  })

  it("křehká zásilka dostane příznak, i když ho data možnosti nemají (živý stav)", () => {
    const data = methodDataFor({
      name: "Česká Pošta - Křehké",
      data: { id: "cp-address", name: "Česká pošta – na adresu", service_code: "DR" },
    })

    expect(data).toEqual({
      id: "cp-address",
      name: "Česká pošta – na adresu",
      service_code: "DR",
      fragile: true,
    })
  })

  it("obyčejná Česká pošta křehká není", () => {
    expect(
      methodDataFor({ name: "Česká Pošta", data: { service_code: "DR" } })
    ).toEqual({ service_code: "DR" })
  })

  it("možnost bez dat nespadne", () => {
    expect(methodDataFor({ name: "Česká pošta – křehké" })).toEqual({ fragile: true })
    expect(methodDataFor({})).toEqual({})
  })
})
