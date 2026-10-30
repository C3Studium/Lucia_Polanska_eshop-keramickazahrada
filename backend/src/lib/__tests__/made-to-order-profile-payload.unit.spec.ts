import {
  PRODUCTION_PROFILE_DEFAULTS,
  mergeProductionProfile,
} from "../made-to-order/profile-payload"

const sjednany = {
  enabled: true,
  specification_required: false,
  specification_prompt: "Pošlete rozměry parapetu a fotku místa.",
  production_time_min_days: 21,
  production_time_max_days: 60,
  default_deposit_percentage: 40,
  contact_customer_after_order: false,
  allow_final_price_adjustment: false,
  allow_full_prepayment: false,
}

describe("mergeProductionProfile — přepínač nesmí přepsat domluvené podmínky", () => {
  it("vypnutí jediným polem nechá zálohu, lhůtu i výzvu beze změny", () => {
    expect(mergeProductionProfile({ enabled: false }, sjednany)).toEqual({
      ...sjednany,
      enabled: false,
    })
  })

  it("opětovné zapnutí vrátí, co bylo domluvené", () => {
    expect(
      mergeProductionProfile({ enabled: true }, { ...sjednany, enabled: false })
    ).toEqual(sjednany)
  })

  it("nový profil (nic uloženého) jede na výchozích", () => {
    expect(mergeProductionProfile({ enabled: true }, null)).toEqual(
      PRODUCTION_PROFILE_DEFAULTS
    )
    expect(PRODUCTION_PROFILE_DEFAULTS.default_deposit_percentage).toBe(25)
  })

  it("co přišlo, vyhrává nad uloženým", () => {
    const merged = mergeProductionProfile(
      { enabled: true, default_deposit_percentage: 10, production_time_max_days: 30 },
      sjednany
    )
    expect(merged.default_deposit_percentage).toBe(10)
    expect(merged.production_time_max_days).toBe(30)
    // Nedotčené pole zůstává sjednané.
    expect(merged.production_time_min_days).toBe(21)
  })

  it("prázdná výzva se dá vymazat, ale ne vynecháním", () => {
    expect(
      mergeProductionProfile({ specification_prompt: "   " }, sjednany)
        .specification_prompt
    ).toBeNull()
    expect(
      mergeProductionProfile({}, sjednany).specification_prompt
    ).toBe(sjednany.specification_prompt)
  })

  it("uložená null spadne na výchozí, false ne", () => {
    const merged = mergeProductionProfile(
      {},
      {
        default_deposit_percentage: null,
        allow_full_prepayment: false,
        production_time_min_days: 0,
      }
    )
    expect(merged.default_deposit_percentage).toBe(25)
    // Vypnuté zůstává vypnuté — `false` není „nevyplněno".
    expect(merged.allow_full_prepayment).toBe(false)
    expect(merged.production_time_min_days).toBe(0)
  })
})
