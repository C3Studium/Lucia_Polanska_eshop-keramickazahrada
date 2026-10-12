import {
  isPackagingLine,
  packagingPriceCzkOf,
  packagingUnitPrice,
  planPackaging,
  roundUpToHalf,
} from "../packaging"
import { withPackagingUnderProducts } from "../packaging-lines"
import { refundAllLines, shippingStateOf } from "../claims/refund-lines"
import { orderItemsForClaims } from "../claims/line-items"

/**
 * Balné jako vlastní položka u každého výrobku (12. 10. 2026).
 */

const sheet = {
  date: "12.10.2026",
  rates: new Map([
    ["EUR", { code: "EUR", amount: 1, rate: 24.4 }],
    ["PLN", { code: "PLN", amount: 1, rate: 5.7 }],
    ["HUF", { code: "HUF", amount: 100, rate: 6.1 }],
  ]),
}

describe("zaokrouhlení a měny", () => {
  it("nahoru na 0,50", () => {
    expect(roundUpToHalf(12.16)).toBe(12.5)
    expect(roundUpToHalf(12.46)).toBe(12.5)
    expect(roundUpToHalf(12.5)).toBe(12.5)
    expect(roundUpToHalf(12.51)).toBe(13)
    expect(roundUpToHalf(0.41)).toBe(0.5)
    expect(roundUpToHalf(0)).toBe(0)
  })

  it("koruna beze změny, cizí měna kurzem ČNB a nahoru na 0,50", () => {
    expect(packagingUnitPrice(50, "czk", null)).toBe(50)
    // 50 / 24,4 = 2,049 → 2,50 EUR
    expect(packagingUnitPrice(50, "eur", sheet as any)).toBe(2.5)
    // 10 / 24,4 = 0,41 → 0,50 EUR
    expect(packagingUnitPrice(10, "eur", sheet as any)).toBe(0.5)
    // 50 / 5,7 = 8,77 → 9,00 PLN
    expect(packagingUnitPrice(50, "pln", sheet as any)).toBe(9)
    // HUF bez desetin: 50 / 0,061 = 819,67 → 820
    expect(packagingUnitPrice(50, "huf", sheet as any)).toBe(820)
  })

  it("bez kurzu cizí měnu neocení (null), nula je nula", () => {
    expect(packagingUnitPrice(50, "usd", sheet as any)).toBeNull()
    expect(packagingUnitPrice(0, "eur", null)).toBe(0)
  })

  it("nevyplněná cena balení = 0", () => {
    expect(packagingPriceCzkOf(null)).toBe(0)
    expect(packagingPriceCzkOf({ packaging_price: "" })).toBe(0)
    expect(packagingPriceCzkOf({ packaging_price: "50" })).toBe(50)
    expect(packagingPriceCzkOf({ packaging_price: -5 })).toBe(0)
  })
})

const product = (id: string, variant: string, quantity: number, title = `Výrobek ${id}`) => ({
  id,
  variant_id: variant,
  product_id: `prod_${variant}`,
  product_title: title,
  quantity,
  unit_price: 500,
})
const packaging = (id: string, variant: string, quantity: number, unit = 50, title = `Balné — Výrobek x`) => ({
  id,
  title,
  quantity,
  unit_price: unit,
  variant_id: null,
  product_id: null,
  metadata: { packaging_fee: true, packaging_variant_id: variant },
})

describe("planPackaging", () => {
  const price50 = () => 50

  it("přidá balné ke každému výrobku se stejným počtem kusů", () => {
    const plan = planPackaging({ items: [product("a", "v1", 2, "Pítko")], unitPriceFor: price50 })
    expect(plan.add).toEqual([
      { variant_id: "v1", product_id: "prod_v1", title: "Balné — Pítko", quantity: 2, unit_price: 50 },
    ])
    expect(plan.update).toEqual([])
    expect(plan.remove_ids).toEqual([])
  })

  it("správný košík = prázdný plán (idempotence)", () => {
    const plan = planPackaging({
      items: [product("a", "v1", 2, "Pítko"), packaging("p1", "v1", 2, 50, "Balné — Pítko")],
      unitPriceFor: price50,
    })
    expect(plan).toEqual({ add: [], update: [], remove_ids: [] })
  })

  it("změna počtu kusů výrobku → upraví balné", () => {
    const plan = planPackaging({
      items: [product("a", "v1", 3, "Pítko"), packaging("p1", "v1", 2, 50, "Balné — Pítko")],
      unitPriceFor: price50,
    })
    expect(plan.update).toEqual([
      { id: "p1", quantity: 3, unit_price: 50, title: "Balné — Pítko", quantity_changed: true },
    ])
  })

  it("odebraný výrobek → balné pryč; duplicitní balné pryč", () => {
    const plan = planPackaging({
      items: [
        product("a", "v1", 1, "Pítko"),
        packaging("p1", "v1", 1, 50, "Balné — Pítko"),
        packaging("p2", "v1", 1, 50, "Balné — Pítko"),
        packaging("p3", "v9", 1),
      ],
      unitPriceFor: price50,
    })
    expect(plan.remove_ids.sort()).toEqual(["p2", "p3"])
  })

  it("výrobek bez ceny balení má balné za 0,- (položka je vždy)", () => {
    const fresh = planPackaging({ items: [product("a", "v1", 2, "Zvonek")], unitPriceFor: () => 0 })
    expect(fresh.add).toEqual([
      { variant_id: "v1", product_id: "prod_v1", title: "Balné — Zvonek", quantity: 2, unit_price: 0 },
    ])
    // Lucie cenu balení smaže → existující balné zůstane, jen za 0.
    const cleared = planPackaging({
      items: [product("a", "v1", 1, "Zvonek"), packaging("p1", "v1", 1, 50, "Balné — Zvonek")],
      unitPriceFor: () => 0,
    })
    expect(cleared.remove_ids).toEqual([])
    expect(cleared.update).toEqual([
      { id: "p1", quantity: 1, unit_price: 0, title: "Balné — Zvonek", quantity_changed: false },
    ])
  })

  it("neznámá cena (chybí kurz) → nic nepřidá a existující nechá být", () => {
    const plan = planPackaging({
      items: [product("a", "v1", 1), product("b", "v2", 1), packaging("p1", "v1", 1)],
      unitPriceFor: () => null,
    })
    expect(plan).toEqual({ add: [], update: [], remove_ids: [] })
  })

  it("doběrečné ani jiný řádek bez varianty se za výrobek nepovažuje", () => {
    const plan = planPackaging({
      items: [{ id: "fee", title: "Doběrečné", quantity: 1, metadata: { dobirka_fee: true } }],
      unitPriceFor: price50,
    })
    expect(plan.add).toEqual([])
  })

  it("podvržená značka na řádku s variantou není balné", () => {
    expect(isPackagingLine({ variant_id: "v1", metadata: { packaging_fee: true } })).toBe(false)
    expect(isPackagingLine(packaging("p1", "v1", 1))).toBe(true)
  })
})

describe("pořadí a reklamace", () => {
  it("balné stojí hned pod svým výrobkem", () => {
    const ordered = withPackagingUnderProducts([
      product("a", "v1", 1),
      product("b", "v2", 1),
      packaging("p2", "v2", 1),
      packaging("p1", "v1", 1),
    ] as any[])
    expect(ordered.map((item: any) => item.id)).toEqual(["a", "p1", "b", "p2"])
  })

  it("zákazník balné ani doběrečné ve výběru reklamace nevidí", () => {
    const items = orderItemsForClaims({
      items: [
        { id: "a", title: "Pítko", quantity: 1, total: 490, variant_id: "v1", product_id: "prod_v1" },
        { id: "p1", title: "Balné — Pítko", quantity: 1, total: 50, metadata: { packaging_fee: true, packaging_variant_id: "v1" } },
        { id: "fee", title: "Doběrečné", quantity: 1, total: 39, metadata: { dobirka_fee: true } },
      ],
    } as any)
    expect(items.map((item) => item.id)).toEqual(["a"])
  })

  const detail = (id: string, overrides: Record<string, unknown>) => ({
    line_item_id: id,
    product_id: null,
    title: id,
    variant_title: null,
    thumbnail: null,
    quantity: 2,
    unit_total: 100,
    line_total: 200,
    is_made_to_order: false,
    is_bundle: false,
    refunded_quantity: 0,
    refundable_quantity: 2,
    refundable_amount: 200,
    selected_in_claim: 0,
    variant_id: null,
    packaging_for_variant_id: null,
    ...overrides,
  })

  it("Vrátit reklamované výrobky = kus i jeho balné, bez poštovného", () => {
    const shipping = shippingStateOf({ shipping_total: 90 } as any, [], { allowRefund: false })
    const lines = refundAllLines(
      [
        detail("a", { variant_id: "v1", selected_in_claim: 1 }),
        detail("p1", { packaging_for_variant_id: "v1", unit_total: 50, refundable_amount: 100 }),
        detail("b", { variant_id: "v2" }),
        detail("p2", { packaging_for_variant_id: "v2", unit_total: 50, refundable_amount: 100 }),
      ] as any,
      shipping,
      1000
    )
    expect(lines).toEqual([
      { type: "item", line_item_id: "a", quantity: 1 },
      { type: "item", line_item_id: "p1", quantity: 1 },
    ])
  })
})

describe("detail objednávky v adminu", () => {
  it("balné hned pod výrobkem jako „↳ Balné“, ostatní beze změny", () => {
    const { packagingUnderProductsInAdminOrder } = require("../packaging")
    let sent: any = null
    const res: any = { json: (body: any) => { sent = body; return res } }
    packagingUnderProductsInAdminOrder()({} as any, res, () => undefined)
    res.json({
      order: {
        items: [
          packaging("p2", "v2", 1, 40, "Balné — Zvonek"),
          product("a", "v1", 1, "Pítko"),
          product("b", "v2", 1, "Zvonek"),
          packaging("p1", "v1", 1, 50, "Balné — Pítko"),
        ],
      },
    })
    expect(sent.order.items.map((item: any) => `${item.id}:${item.title ?? item.product_title}`)).toEqual([
      "a:Pítko",
      "p1:↳ Balné",
      "b:Zvonek",
      "p2:↳ Balné",
    ])
  })
})
