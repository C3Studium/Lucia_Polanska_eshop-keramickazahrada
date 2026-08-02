import { presentBundle } from "../presentation"

const variant = (id: string, amount: number, inventory = 10) => ({
  id,
  calculated_price: { calculated_amount: amount },
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: inventory,
})

describe("presentBundle", () => {
  it("orders items and calculates a discounted component price range", () => {
    const result = presentBundle({
      id: "bundle_1",
      pricing_mode: "component_sum_discount",
      discount_percentage: 10,
      items: [
        {
          id: "item_2",
          display_order: 2,
          quantity: 2,
          variant_mode: "customer_selects",
          product: { id: "prod_2", variants: [variant("v2", 50)] },
        },
        {
          id: "item_1",
          display_order: 1,
          quantity: 1,
          variant_mode: "customer_selects",
          product: { id: "prod_1", variants: [variant("v1", 100)] },
        },
      ],
    })

    expect(result.items.map((item: any) => item.id)).toEqual(["item_1", "item_2"])
    expect(result.calculated_bundle_price).toMatchObject({ min: 180, max: 180 })
    expect(result.availability.is_available).toBe(true)
  })

  it("uses the bundle product price and fixed-variant availability", () => {
    const result = presentBundle({
      id: "bundle_2",
      pricing_mode: "fixed_price",
      product: { variants: [variant("bundle-variant", 250)] },
      items: [{
        id: "item_1",
        display_order: 0,
        quantity: 2,
        variant_mode: "fixed_variant",
        product: { variants: [variant("fixed", 140, 1)] },
        product_variant: variant("fixed", 140, 1),
      }],
    })

    expect(result.calculated_bundle_price).toMatchObject({ min: 250, max: 250 })
    expect(result.items[0].fixed_variant_id).toBe("fixed")
    expect(result.availability.is_available).toBe(false)
  })
})
