import { fulfillmentItemsOf, shipmentItemsOf } from "../shipment-items"

/**
 * Balné (servisní řádek, requires_shipping=false) musí jít do vyskladnění,
 * jinak objednávka zůstane napořád „Částečně splněno" (#50, 14. 10. 2026).
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

describe("vyskladnění a odeslání se servisními řádky", () => {
  it("vyskladnění bere výrobek i balné", () => {
    expect(fulfillmentItemsOf({ items: [product(), balne()] })).toEqual([
      { id: "z", quantity: 1 },
      { id: "b", quantity: 1 },
    ])
  })

  it("odeslání bere balné jen, když je vyskladněné", () => {
    // #50: výrobek vyskladněný štítkem, balné ne → odeslat jen výrobek.
    expect(
      shipmentItemsOf({ items: [product({ fulfilled_quantity: 1 }), balne()] })
    ).toEqual([{ id: "z", quantity: 1 }])
    // Nově: obojí vyskladněné → odeslat obojí.
    expect(
      shipmentItemsOf({
        items: [product({ fulfilled_quantity: 1 }), balne({ fulfilled_quantity: 1 })],
      })
    ).toEqual([
      { id: "z", quantity: 1 },
      { id: "b", quantity: 1 },
    ])
  })

  it("běžná položka bez dopravy (ne servisní) se dál přeskakuje", () => {
    const digital = { id: "d", quantity: 1, requires_shipping: false, variant_id: "vd", product_id: "pd" }
    expect(fulfillmentItemsOf({ items: [digital] })).toEqual([])
  })
})
