import {
  INTERNATIONAL_OPTION_NAME,
  internationalMethodName,
  internationalPriceFor,
  internationalQuoteFor,
  internationalQuoteForItems,
  normalizePricesCzk,
  parcelWeightOf,
} from "../international-shipping-price"
import { cpAllQuotes, cpCheapest, cpPriceCzk, cpQuote, cpShipsTo } from "../cp-kalkulacka"
import CeskaPostaFulfillmentService from "../../modules/ceskaPostaFulfillment/service"

const PRIO = "Standardní balík do zahraničí - prioritní"
const EKO = "Standardní balík do zahraničí - ekonomický"
const OBCH = "Obchodní balík do zahraničí"

/* Data volby, jak je uloží administrace (kurz EUR 24,34 Kč). */
const option = (over: Record<string, unknown> = {}) => ({
  id: "cp-international",
  service_code: "INT",
  international: true,
  countries: ["de", "sk", "fr"],
  overrides_czk: {},
  /* Starší testy počítají s jedinou službou; nejlevnější z více viz níž. */
  services: [PRIO],
  parcel_weight_kg: 3,
  packaging_kg: 0,
  currency_by_country: { de: "eur", sk: "eur", fr: "eur", gb: "eur" },
  rates: { EUR: { amount: 1, rate: 24.34 } },
  rates_date: "19.11.2026",
  ...over,
})

const line = (grams: number | null, quantity = 1) => ({
  product_id: "prod",
  variant_id: "var",
  quantity,
  metadata: grams === null ? {} : { ship_weight_g: grams },
})

describe("kalkulačka ČP do zahraničí (ceník 19. 11. 2026)", () => {
  it("cena prvního stupně, který hmotnost pokryje", () => {
    // DE prioritní: do 0,5 / 1 kg 331, do 3 kg 470…; tabulka v PLAN.md §3.
    expect(cpPriceCzk("de", PRIO, 2)).toBe(416)
    expect(cpPriceCzk("de", PRIO, 1.01)).toBe(416) // 1,01 kg → „do 2 kg"
    expect(cpPriceCzk("de", PRIO, 5)).toBe(589)
    expect(cpPriceCzk("DE", PRIO, 10)).toBe(877)
    expect(cpPriceCzk("de", PRIO, 30)).not.toBeNull()
    expect(cpPriceCzk("de", PRIO, 30.1)).toBeNull()
    expect(cpPriceCzk("de", PRIO, 0)).toBeNull()
    expect(cpPriceCzk("xx", PRIO, 1)).toBeNull()
  })

  it("náhradní služba, když zvolená do země nejede nebo nebere váhu", () => {
    // SK nemá ekonomický → prioritní.
    expect(cpQuote("sk", EKO, 2)).toMatchObject({ service: PRIO, price_czk: 416, fallback: true })
    // SK prioritní končí na 20 kg → 25 kg jede dál (obchodní balík).
    const tezky = cpQuote("sk", PRIO, 25)
    expect(tezky?.fallback).toBe(true)
    expect(tezky?.up_to_kg).toBeGreaterThanOrEqual(25)
    expect(cpQuote("de", PRIO, 3)).toMatchObject({ service: PRIO, fallback: false, up_to_kg: 3 })
  })

  it("ví, kam ČP balík vůbec nevozí", () => {
    expect(cpShipsTo("de")).toBe(true)
    expect(cpShipsTo("xx")).toBe(false)
    expect(cpAllQuotes("de", 5).find((row) => row.service === PRIO)?.price_czk).toBe(589)
  })
})

describe("nejlevnější služba (Matěj 19. 11. 2026)", () => {
  it("vybere nejlevnější službu pro zemi a hmotnost", () => {
    expect(cpCheapest("de", 5)).toMatchObject({ service: EKO, price_czk: 544, up_to_kg: 5 })
    expect(cpCheapest("sk", 2)).toMatchObject({ service: OBCH, price_czk: 315 })
    // jen z povolených služeb
    expect(cpCheapest("sk", 2, [PRIO, EKO])).toMatchObject({ service: PRIO, price_czk: 416 })
    expect(cpCheapest("de", 31)).toBeNull()
    expect(cpCheapest("xx", 2)).toBeNull()
  })

  it("cena i název dopravy podle vybrané služby", () => {
    const q = internationalQuoteForItems(option({ services: [] }), "sk", [line(1800)])
    expect(q).toMatchObject({ service: OBCH, price_czk: 315, up_to_kg: 2, weight: { kg: 1.8, source: "vyrobky" } })
    expect(internationalMethodName(q)).toBe("Česká pošta – Obchodní balík do zahraničí (do 2 kg)")
    expect(internationalMethodName(internationalQuoteFor(option({ services: [] }), "de", 0.4))).toBe(
      "Česká pošta – Standardní balík do zahraničí - ekonomický (do 0,5 kg)"
    )
  })

  it("ruční cena země nebo žádná cena = obecný název", () => {
    expect(internationalMethodName(internationalQuoteFor(option({ overrides_czk: { de: 500 } }), "de", 2))).toBe(
      INTERNATIONAL_OPTION_NAME
    )
    expect(internationalMethodName(null)).toBe(INTERNATIONAL_OPTION_NAME)
  })
})

describe("hmotnost zásilky", () => {
  const settings = { parcel_weight_kg: 3, packaging_kg: 0 }

  it("mají-li hmotnost všechny výrobky, sečte se (× počet kusů)", () => {
    expect(parcelWeightOf([line(450, 2), line(800)], settings)).toEqual({ kg: 1.7, source: "vyrobky", missing: 0 })
    expect(parcelWeightOf([line(450, 2)], { parcel_weight_kg: 3, packaging_kg: 1 }).kg).toBe(1.9)
  })

  it("chybí-li hmotnost aspoň jednomu, vezme se průměr z nastavení", () => {
    expect(parcelWeightOf([line(450), line(null)], settings)).toEqual({ kg: 3, source: "prumer", missing: 1 })
    expect(parcelWeightOf([], settings).source).toBe("prumer")
  })

  it("balné a doběrečné se nepočítají", () => {
    const balne = { product_id: null, variant_id: null, quantity: 1, metadata: { packaging_fee: true } }
    expect(parcelWeightOf([line(1200), balne], settings)).toMatchObject({ kg: 1.2, source: "vyrobky" })
  })
})

describe("cena do zahraničí", () => {
  it("ceník ČP pro hmotnost → eura kurzem ČNB", () => {
    const quote = internationalQuoteFor(option(), "DE", 5)
    expect(quote).toMatchObject({ price_czk: 589, currency_code: "eur", amount: 24.2, manual: false })
  })

  it("ruční cena majitelky přepíše ceník", () => {
    expect(internationalQuoteFor(option({ overrides_czk: { de: 500 } }), "de", 5)).toMatchObject({
      price_czk: 500,
      manual: true,
      service: null,
    })
  })

  it("nepovolená země, chybějící kurz nebo moc těžký balík = žádná cena", () => {
    expect(internationalQuoteFor(option(), "gb", 2)).toBeNull()
    expect(internationalQuoteFor(option({ rates: {} }), "de", 2)).toBeNull()
    expect(internationalQuoteFor(option(), "de", 31)).toBeNull()
    expect(internationalQuoteFor({ service_code: "DR" }, "de", 2)).toBeNull()
  })

  it("v pokladně z košíku: vyplněné hmotnosti, jinak průměr", () => {
    expect(internationalPriceFor(option(), "de", [line(1800)])).toMatchObject({ kg: 1.8, amount: 17.09 })
    expect(internationalPriceFor(option(), "de", [line(1800), line(null)])).toMatchObject({ kg: 3 })
  })

  it("očistí ruční ceny: jen platné kladné, nikdy Česko", () => {
    expect(
      normalizePricesCzk({ SK: "350", de: 520.4, cz: 90, pl: "", fr: 0, it: -5, es: "abc", xx1: 10, gb: 25000 })
    ).toEqual({ sk: 350, de: 520 })
  })
})

describe("dopravce Česká pošta — zahraničí", () => {
  it("účtuje cenu podle košíku a zemi bez ceny odmítne", async () => {
    const service = new CeskaPostaFulfillmentService({ logger: console } as any, {})
    await expect(
      service.calculatePrice(option(), {}, { shipping_address: { country_code: "de" }, items: [line(4500)] })
    ).resolves.toEqual({ calculated_amount: 24.2, is_calculated_price_tax_inclusive: true })
    await expect(
      service.calculatePrice(option(), {}, { shipping_address: { country_code: "gb" }, items: [] })
    ).rejects.toThrow(/GB/)
  })

  it("balík do zahraničí se nepodává přes API — jen zaznamená ručně", async () => {
    const service = new CeskaPostaFulfillmentService({ logger: { info: () => {}, error: () => {}, warn: () => {} } } as any, {
      api_url: "x", api_token: "x", api_secret: "x", customer_id: "x", post_code: "x", location_number: "x",
    } as any)
    const result: any = await service.createFulfillment(
      { service_code: "INT", international: true },
      [],
      { display_id: 99 } as any,
      {} as any
    )
    expect(result.data).toMatchObject({ mode: "manual", international: true, service_code: "INT" })
  })
})
