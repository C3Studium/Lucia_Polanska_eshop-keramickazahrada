import {
  fulfillmentItemsOf,
  serviceLinesOutstanding,
  shipmentItemsOf,
} from "../shipment-items"

/**
 * Balné (servisní řádek, requires_shipping=false) NESMÍ do plnění u dopravce:
 * Medusa smíšené plnění odmítne („Fulfillment can only be created entirely
 * with items with shipping or items without shipping") a samostatné plnění by
 * šlo přes ČP jako druhá zásilka. 14. 10. 2026 se do plnění dostalo a štítek,
 * odeslání i osobní odběr padaly u každé objednávky s balným (log produkce
 * 16. 10.). Balné se zapisuje zvlášť — `serviceLinesOutstanding` +
 * lib/service-lines-settle.ts.
 */
const product = (detail: Record<string, number> = {}) => ({
  id: "z",
  quantity: 1,
  requires_shipping: true,
  variant_id: "v",
  product_id: "p",
  detail,
})
const balne = (detail: Record<string, number> = {}) => ({
  id: "b",
  quantity: 1,
  requires_shipping: false,
  variant_id: null,
  product_id: null,
  metadata: { packaging_fee: true },
  detail,
})
const doberecne = () => ({
  id: "d",
  quantity: 1,
  requires_shipping: false,
  variant_id: null,
  product_id: null,
  metadata: { dobirka_fee: true },
  detail: {},
})

describe("plnění u dopravce jen se zbožím", () => {
  it("vyskladnění bere jen zboží — balné ani doběrečné ne (Medusa by smíšené plnění odmítla)", () => {
    expect(fulfillmentItemsOf({ items: [product(), balne(), doberecne()] })).toEqual([
      { id: "z", quantity: 1 },
    ])
  })

  it("odeslání bere jen zboží", () => {
    expect(
      shipmentItemsOf({ items: [product({ fulfilled_quantity: 1 }), balne({ fulfilled_quantity: 1 })] })
    ).toEqual([{ id: "z", quantity: 1 }])
  })

  it("běžná položka bez dopravy (ne servisní) se přeskakuje i tady", () => {
    const digital = { id: "x", quantity: 1, requires_shipping: false, variant_id: "vx", product_id: "px" }
    expect(fulfillmentItemsOf({ items: [digital] })).toEqual([])
    expect(serviceLinesOutstanding({ items: [digital] })).toEqual({ fulfill: [], ship: [] })
  })
})

describe("servisní řádky k zápisu (bez dopravce)", () => {
  it("nevyskladněné balné i doběrečné → vyskladnit i odeslat", () => {
    expect(serviceLinesOutstanding({ items: [product(), balne(), doberecne()] })).toEqual({
      fulfill: [
        { id: "b", quantity: 1 },
        { id: "d", quantity: 1 },
      ],
      ship: [
        { id: "b", quantity: 1 },
        { id: "d", quantity: 1 },
      ],
    })
  })

  it("už zapsané nic dalšího nechce (idempotentní)", () => {
    expect(
      serviceLinesOutstanding({ items: [balne({ fulfilled_quantity: 1, shipped_quantity: 1 })] })
    ).toEqual({ fulfill: [], ship: [] })
  })

  it("vyskladněné a neodeslané → jen odeslat", () => {
    expect(serviceLinesOutstanding({ items: [balne({ fulfilled_quantity: 1 })] })).toEqual({
      fulfill: [],
      ship: [{ id: "b", quantity: 1 }],
    })
  })
})
