import {
  basePrices,
  parseSaleDescription,
  saleDescription,
  salePrices,
  saleState,
} from "../product-sale"

describe("sleva u výrobku — popis ceníku", () => {
  it("zapíše a přečte výrobek a procenta", () => {
    const text = saleDescription("prod_01ABC", 20)
    expect(parseSaleDescription(text)).toEqual({ productId: "prod_01ABC", percent: 20 })
  })

  it("cizí ceník (sezónní akce, ruční) není sleva u výrobku", () => {
    expect(parseSaleDescription("Automaticky vytvořeno k sezónní akci Vánoce.")).toBeNull()
    expect(parseSaleDescription(null)).toBeNull()
    expect(parseSaleDescription("kz:product-sale:prod_1:abc")).toBeNull()
  })
})

describe("sleva u výrobku — ceny", () => {
  it("základní ceny bere jen bez ceníku a bez pravidel", () => {
    const variant = {
      id: "v1",
      prices: [
        { currency_code: "czk", amount: 950, price_list_id: null, rules_count: 0 },
        { currency_code: "czk", amount: 760, price_list_id: "plist_1", rules_count: 0 },
        { currency_code: "eur", amount: 38.5, price_list_id: null, rules_count: 0 },
        { currency_code: "czk", amount: 900, price_list_id: null, rules_count: 1 },
      ],
    }
    expect(basePrices(variant)).toEqual([
      { currency_code: "czk", amount: 950 },
      { currency_code: "eur", amount: 38.5 },
    ])
  })

  it("Kč zaokrouhlí na celé koruny, eura na centy", () => {
    const prices = salePrices(
      [
        {
          id: "v1",
          prices: [
            { currency_code: "czk", amount: 950 },
            { currency_code: "eur", amount: 38.5 },
          ],
        },
      ],
      15
    )
    expect(prices).toEqual([
      { variant_id: "v1", currency_code: "czk", amount: 808 },
      { variant_id: "v1", currency_code: "eur", amount: 32.73 },
    ])
  })

  it("nulovou nebo chybějící cenu přeskočí (cena po domluvě)", () => {
    expect(
      salePrices([{ id: "v1", prices: [{ currency_code: "czk", amount: 0 }] }], 20)
    ).toEqual([])
  })

  it("akční cena nikdy neklesne pod 1", () => {
    expect(
      salePrices([{ id: "v1", prices: [{ currency_code: "czk", amount: 1 }] }], 90)
    ).toEqual([{ variant_id: "v1", currency_code: "czk", amount: 1 }])
  })
})

describe("sleva u výrobku — stav", () => {
  const now = new Date("2026-12-10T12:00:00Z")

  it("vypnutá", () => {
    expect(saleState({ status: "draft", starts_at: null, ends_at: null }, now)).toBe("off")
  })

  it("běží bez dat i v období", () => {
    expect(saleState({ status: "active", starts_at: null, ends_at: null }, now)).toBe("running")
    expect(
      saleState(
        { status: "active", starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-12-24T22:59:59Z" },
        now
      )
    ).toBe("running")
  })

  it("naplánovaná a skončená", () => {
    expect(
      saleState({ status: "active", starts_at: "2026-12-20T00:00:00Z", ends_at: null }, now)
    ).toBe("scheduled")
    expect(
      saleState({ status: "active", starts_at: null, ends_at: "2026-12-01T00:00:00Z" }, now)
    ).toBe("ended")
  })
})
