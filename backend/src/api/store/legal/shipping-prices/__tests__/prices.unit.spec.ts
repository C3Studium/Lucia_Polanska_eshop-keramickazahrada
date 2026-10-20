import {
  buildShippingPrices,
  freeFrom,
  isPublicOption,
  pricesForRegion,
  type RawRegion,
  type RawShippingOption,
} from "../prices"

const cz: RawRegion = {
  id: "reg_cz",
  name: "Česká republika",
  currency_code: "czk",
  countries: [{ iso_2: "cz" }],
}
const eu: RawRegion = {
  id: "reg_eu",
  name: "Europe",
  currency_code: "eur",
  countries: [{ iso_2: "sk" }, { iso_2: "de" }],
}

const zone = (...codes: string[]) => ({
  geo_zones: codes.map((country_code) => ({ country_code })),
  fulfillment_set: { type: "shipping" },
})

describe("legal shipping prices", () => {
  it("skips return options and options hidden from the store", () => {
    expect(
      isPublicOption({ id: "a", rules: [{ attribute: "is_return", value: '"true"' }] })
    ).toBe(false)
    expect(
      isPublicOption({ id: "b", rules: [{ attribute: "enabled_in_store", value: "false" }] })
    ).toBe(false)
    expect(
      isPublicOption({
        id: "c",
        rules: [
          { attribute: "is_return", value: "false" },
          { attribute: "enabled_in_store", value: "true" },
        ],
      })
    ).toBe(true)
  })

  it("prefers a region-bound price and reads the free-shipping tier", () => {
    const option: RawShippingOption = {
      id: "so_balikovna",
      prices: [
        { amount: 89, currency_code: "czk" },
        { amount: 79, currency_code: "czk", price_rules: [{ attribute: "region_id", value: "reg_cz" }] },
        {
          amount: 0,
          currency_code: "czk",
          price_rules: [{ attribute: "item_total", operator: "gte", value: "1000" }],
        },
        { amount: 59, currency_code: "czk", price_rules: [{ attribute: "region_id", value: "reg_other" }] },
      ],
    }
    const { amount, tiers } = pricesForRegion(option, cz)
    expect(amount).toBe(79)
    expect(freeFrom(tiers)).toBe(1000)
  })

  it("groups options by country with the region currency, Czechia first", () => {
    const result = buildShippingPrices(
      [
        {
          id: "so_sk",
          name: "Balíkovna",
          price_type: "flat",
          service_zone: zone("sk"),
          prices: [
            { amount: 3.5, currency_code: "eur" },
            { amount: 79, currency_code: "czk" },
          ],
        },
        {
          id: "so_cz",
          name: "Česká pošta – na adresu",
          price_type: "flat",
          service_zone: zone("cz"),
          prices: [{ amount: 95, currency_code: "czk" }],
        },
        {
          id: "so_pickup",
          name: "Osobní odběr v dílně",
          price_type: "flat",
          service_zone: { geo_zones: [{ country_code: "cz" }], fulfillment_set: { type: "pickup" } },
          prices: [{ amount: 0, currency_code: "czk" }],
        },
        {
          id: "so_return",
          name: "Česká pošta – křehké (vrácení)",
          rules: [{ attribute: "is_return", value: "true" }],
          service_zone: zone("cz"),
          prices: [{ amount: 150, currency_code: "czk" }],
        },
        {
          // No EUR price → not orderable in Germany, so not listed.
          id: "so_de",
          name: "Nikam",
          price_type: "flat",
          service_zone: zone("de"),
          prices: [{ amount: 200, currency_code: "czk" }],
        },
      ],
      [cz, eu]
    )

    expect(result.map((country) => country.country_code)).toEqual(["cz", "sk"])
    expect(result[0].currency_code).toBe("czk")
    expect(result[0].options.map((option) => option.id)).toEqual(["so_cz", "so_pickup"])
    expect(result[0].options[1].type).toBe("pickup")
    expect(result[1].options[0]).toMatchObject({ id: "so_sk", amount: 3.5, free_from: null })
  })

  it("keeps calculated options without inventing a price", () => {
    const [country] = buildShippingPrices(
      [{ id: "so_calc", name: "Počítaná", price_type: "calculated", service_zone: zone("cz"), prices: [] }],
      [cz]
    )
    expect(country.options[0]).toMatchObject({ price_type: "calculated", amount: null })
  })
})
