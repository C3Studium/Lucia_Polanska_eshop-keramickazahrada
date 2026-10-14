import {
  addDays,
  computePriceReference,
  findSaleRunStart,
  observationsFromCalculatedPrice,
  planDailyUpsert,
  pragueDay,
  toAmount,
  type PriceHistoryPoint,
} from "../price-reference"

/** Řada denních záznamů od `from` do `to` včetně. */
const days = (
  from: string,
  to: string,
  kind: "base" | "sale",
  amount: number
): PriceHistoryPoint[] => {
  const out: PriceHistoryPoint[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    out.push({ recorded_on: day, kind, amount })
  }
  return out
}

const TODAY = "2026-10-14"

describe("pragueDay / addDays", () => {
  it("bere kalendářní den v Praze, ne v UTC", () => {
    // 23:30 UTC 14. 10. je v Praze (CEST, +2) už 15. 10.
    expect(pragueDay(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15")
    // V zimě (+1): 23:30 UTC 14. 1. = 00:30 15. 1.
    expect(pragueDay(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-15")
    expect(pragueDay(new Date("2026-10-14T21:59:00Z"))).toBe("2026-10-14")
  })

  it("posouvá přes konec měsíce i změnu času", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30")
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30")
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26")
    expect(addDays("2026-10-14", -30)).toBe("2026-09-14")
  })
})

describe("toAmount", () => {
  it("čte číslo, řetězec i BigNumber-like objekt", () => {
    expect(toAmount(120)).toBe(120)
    expect(toAmount("99.5")).toBe(99.5)
    expect(toAmount({ numeric: 450 })).toBe(450)
    expect(toAmount({ value: "12.5" })).toBe(12.5)
    expect(toAmount(null)).toBeNull()
    expect(toAmount("abc")).toBeNull()
  })
})

describe("computePriceReference", () => {
  it("varianta mimo slevu nemá referenční cenu", () => {
    expect(
      computePriceReference({
        entries: days("2026-09-01", TODAY, "base", 1000),
        today: TODAY,
        onSaleNow: false,
        currentBase: 1000,
      })
    ).toEqual({ lowest_30d: null, sale_started_on: null, complete: false })
  })

  it("zdražení těsně před slevou: nejnižší je stará nižší cena", () => {
    const entries = [
      ...days("2026-08-01", "2026-09-30", "base", 800),
      // 1. 10. zdraženo na 1000 …
      ...days("2026-10-01", TODAY, "base", 1000),
      // … a od 10. 10. „sleva" na 900.
      ...days("2026-10-10", TODAY, "sale", 900),
    ]
    expect(
      computePriceReference({
        entries,
        today: TODAY,
        onSaleNow: true,
        currentBase: 1000,
      })
    ).toEqual({ lowest_30d: 800, sale_started_on: "2026-10-10", complete: true })
  })

  it("běžná sleva s úplnou historií: reference je běžná cena", () => {
    const entries = [
      ...days("2026-08-01", TODAY, "base", 1200),
      ...days("2026-10-05", TODAY, "sale", 960),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 1200 })
    ).toEqual({ lowest_30d: 1200, sale_started_on: "2026-10-05", complete: true })
  })

  it("předchozí sleva v okně 30 dní se počítá", () => {
    const entries = [
      ...days("2026-08-01", TODAY, "base", 1000),
      // Sleva 20.–25. 9. za 700, pak pauza, nová sleva od 12. 10.
      ...days("2026-09-20", "2026-09-25", "sale", 700),
      ...days("2026-10-12", TODAY, "sale", 850),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 1000 })
    ).toEqual({ lowest_30d: 700, sale_started_on: "2026-10-12", complete: true })
  })

  it("navazující slevy jsou jeden běh — reference je cena před první", () => {
    const entries = [
      ...days("2026-07-01", TODAY, "base", 1000),
      ...days("2026-09-01", "2026-09-30", "sale", 900),
      ...days("2026-10-01", TODAY, "sale", 750),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 1000 })
    ).toEqual({ lowest_30d: 1000, sale_started_on: "2026-09-01", complete: true })
  })

  it("historie od nasazení nepokrývá okno: přidá dnešní běžnou cenu, complete: false", () => {
    // Nasazeno 10. 10., sleva už běží.
    const entries = [
      ...days("2026-10-10", TODAY, "base", 1000),
      ...days("2026-10-10", TODAY, "sale", 800),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 1000 })
    ).toEqual({ lowest_30d: 1000, sale_started_on: "2026-10-10", complete: false })
  })

  it("historie začala uprostřed slevy: začátek z price-listu, pořád neúplné", () => {
    const entries = [
      ...days("2026-10-10", TODAY, "base", 1000),
      ...days("2026-10-10", TODAY, "sale", 800),
    ]
    expect(
      computePriceReference({
        entries,
        today: TODAY,
        onSaleNow: true,
        priceListStartsOn: "2026-10-01",
        currentBase: 1000,
      })
    ).toEqual({ lowest_30d: 1000, sale_started_on: "2026-10-01", complete: false })
  })

  it("žádná historie (před prvním během jobu): začátek z price-listu, jinak dnes", () => {
    expect(
      computePriceReference({
        entries: [],
        today: TODAY,
        onSaleNow: true,
        priceListStartsOn: "2026-10-01",
        currentBase: 990,
      })
    ).toEqual({ lowest_30d: 990, sale_started_on: "2026-10-01", complete: false })

    expect(
      computePriceReference({ entries: [], today: TODAY, onSaleNow: true, currentBase: null })
    ).toEqual({ lowest_30d: null, sale_started_on: TODAY, complete: false })
  })

  it("sleva začala dnes po ranním běhu: začíná dnes, okno je 30 dní před dneškem", () => {
    const entries = [
      ...days("2026-08-20", "2026-09-30", "base", 600),
      ...days("2026-10-01", TODAY, "base", 650),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 650 })
    ).toEqual({ lowest_30d: 600, sale_started_on: TODAY, complete: true })
  })

  it("starý price-list s novou variantou: začátek podle historie, ne podle starts_at", () => {
    // Price-list běží od srpna, varianta do něj přibyla 11. 10.
    const entries = [
      ...days("2026-08-01", TODAY, "base", 500),
      ...days("2026-10-11", TODAY, "sale", 400),
    ]
    expect(
      computePriceReference({
        entries,
        today: TODAY,
        onSaleNow: true,
        priceListStartsOn: "2026-08-15",
        currentBase: 500,
      })
    ).toEqual({ lowest_30d: 500, sale_started_on: "2026-10-11", complete: true })
  })

  it("krátký výpadek jobu běh slevy nepřeruší", () => {
    const entries = [
      ...days("2026-08-01", "2026-09-30", "base", 1000),
      ...days("2026-10-01", "2026-10-05", "sale", 800),
      ...days("2026-10-01", "2026-10-05", "base", 1000),
      // 6.–7. 10. job neběžel
      ...days("2026-10-08", TODAY, "sale", 800),
      ...days("2026-10-08", TODAY, "base", 1000),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 1000 })
    ).toEqual({ lowest_30d: 1000, sale_started_on: "2026-10-01", complete: true })
  })

  it("dnešek ještě bez záznamu se přeskočí, běh pokračuje ze včerejška", () => {
    const entries = [
      ...days("2026-08-01", "2026-10-13", "base", 1000),
      ...days("2026-10-09", "2026-10-13", "sale", 700),
    ]
    expect(findSaleRunStart(entries, TODAY)).toBe("2026-10-09")
  })

  it("výrobek v okně nebyl v prodeji (žádné záznamy): neúplné, padne na dnešní cenu", () => {
    const entries = [
      ...days("2026-06-01", "2026-08-31", "base", 300),
      ...days("2026-10-12", TODAY, "base", 400),
      ...days("2026-10-12", TODAY, "sale", 350),
    ]
    expect(
      computePriceReference({ entries, today: TODAY, onSaleNow: true, currentBase: 400 })
    ).toEqual({ lowest_30d: 400, sale_started_on: "2026-10-12", complete: false })
  })
})

describe("observationsFromCalculatedPrice", () => {
  it("bez slevy zapíše jen běžnou cenu", () => {
    expect(
      observationsFromCalculatedPrice("variant_1", "CZK", {
        calculated_amount: 500,
        original_amount: 500,
        calculated_price: { price_list_id: null, price_list_type: null },
      })
    ).toEqual([
      {
        variant_id: "variant_1",
        currency_code: "czk",
        kind: "base",
        amount: 500,
        price_list_id: null,
      },
    ])
  })

  it("se slevou zapíše běžnou i akční cenu s price-listem", () => {
    expect(
      observationsFromCalculatedPrice("variant_1", "eur", {
        calculated_amount: 18.5,
        original_amount: 22,
        calculated_price: { price_list_id: "plist_1", price_list_type: "sale" },
      })
    ).toEqual([
      expect.objectContaining({ kind: "base", amount: 22 }),
      expect.objectContaining({ kind: "sale", amount: 18.5, price_list_id: "plist_1" }),
    ])
  })

  it("override price-list ani „sleva“ za stejnou cenu se jako sleva nezapíše", () => {
    const override = observationsFromCalculatedPrice("v", "czk", {
      calculated_amount: 400,
      original_amount: 400,
      calculated_price: { price_list_id: "plist_o", price_list_type: "override" },
    })
    expect(override.map((o) => o.kind)).toEqual(["base"])

    const flat = observationsFromCalculatedPrice("v", "czk", {
      calculated_amount: 400,
      original_amount: 400,
      calculated_price: { price_list_id: "plist_s", price_list_type: "sale" },
    })
    expect(flat.map((o) => o.kind)).toEqual(["base"])
  })

  it("bez ceny nic", () => {
    expect(observationsFromCalculatedPrice("v", "czk", null)).toEqual([])
    expect(
      observationsFromCalculatedPrice("v", "czk", { calculated_amount: null, original_amount: null })
    ).toEqual([])
  })
})

describe("planDailyUpsert", () => {
  const obs = (kind: "base" | "sale", amount: number, variant = "v1") => ({
    variant_id: variant,
    currency_code: "czk",
    kind,
    amount,
    price_list_id: null,
  })

  it("chybějící řádek založí, stejnou cenu nepřepisuje", () => {
    const plan = planDailyUpsert(
      [{ id: "phe_1", variant_id: "v1", currency_code: "czk", kind: "base", amount: 500 }],
      [obs("base", 500), obs("sale", 450)],
      TODAY
    )
    expect(plan.update).toEqual([])
    expect(plan.create).toEqual([{ ...obs("sale", 450), recorded_on: TODAY }])
  })

  it("nižší cena během dne řádek posune dolů, vyšší ho nechá", () => {
    const existing = [
      { id: "phe_1", variant_id: "v1", currency_code: "czk", kind: "base", amount: 500 },
      { id: "phe_2", variant_id: "v2", currency_code: "czk", kind: "base", amount: { numeric: 300 } },
    ]
    const plan = planDailyUpsert(
      existing,
      [obs("base", 480), obs("base", 350, "v2")],
      TODAY
    )
    expect(plan.create).toEqual([])
    expect(plan.update).toEqual([{ id: "phe_1", amount: 480, price_list_id: null }])
  })

  it("dvě pozorování téhož klíče v jednom běhu → zapíše nižší", () => {
    const plan = planDailyUpsert([], [obs("base", 520), obs("base", 510)], TODAY)
    expect(plan.create).toEqual([{ ...obs("base", 510), recorded_on: TODAY }])
  })
})
