import { classifyVariant, thresholdFor } from "../inventory-alerts"

const variant = (overrides: Record<string, unknown> = {}) => ({
  id: "variant_1",
  title: "Modrá",
  sku: "HRN-MOD",
  manage_inventory: true,
  product: { id: "prod_1", title: "Hrnek" },
  inventory: [
    {
      id: "iitem_1",
      metadata: null,
      location_levels: [{ stocked_quantity: 10, reserved_quantity: 0 }],
    },
  ],
  ...overrides,
})

const withStock = (stocked: number, reserved = 0, metadata: unknown = null) =>
  variant({
    inventory: [
      {
        id: "iitem_1",
        metadata,
        location_levels: [
          { stocked_quantity: stocked, reserved_quantity: reserved },
        ],
      },
    ],
  })

const none = new Set<string>()

describe("threshold merge", () => {
  it("falls back to the shop default", () => {
    expect(thresholdFor({ metadata: null }, 3)).toEqual({
      threshold: 3,
      custom: false,
    })
  })

  it("lets the item override it", () => {
    expect(thresholdFor({ metadata: { low_stock_threshold: 8 } }, 3)).toEqual({
      threshold: 8,
      custom: true,
    })
  })

  it("accepts zero as a deliberate override, not a missing value", () => {
    // 0 is falsy but meaningful: „warn me only when it is actually gone".
    expect(thresholdFor({ metadata: { low_stock_threshold: 0 } }, 3)).toEqual({
      threshold: 0,
      custom: true,
    })
  })

  it("ignores junk and negative overrides", () => {
    expect(thresholdFor({ metadata: { low_stock_threshold: "tři" } }, 3))
      .toEqual({ threshold: 3, custom: false })
    expect(thresholdFor({ metadata: { low_stock_threshold: -2 } }, 3)).toEqual({
      threshold: 3,
      custom: false,
    })
  })
})

describe("classifyVariant", () => {
  it("counts availability, not stock on the shelf", () => {
    // Six pieces exist but five are reserved for orders already paid for —
    // only one is actually sellable, which is what a low-stock warning is about.
    const result = classifyVariant(withStock(6, 5), 3, none)

    expect(result?.bucket).toBe("low")
    expect(result?.row.available).toBe(1)
    expect(result?.row.stocked).toBe(6)
    expect(result?.row.reserved).toBe(5)
  })

  it("treats the threshold as inclusive and calls healthy stock healthy", () => {
    expect(classifyVariant(withStock(3), 3, none)?.bucket).toBe("low")
    // Above the threshold is not an alert, but it is still stock she owns —
    // „what do I actually have?" is asked as often as „what is running out?".
    expect(classifyVariant(withStock(4), 3, none)?.bucket).toBe("ok")
  })

  it("carries the location, so the row can be restocked and not only read", () => {
    const located = variant({
      inventory: [
        {
          id: "iitem_1",
          metadata: null,
          location_levels: [
            {
              location_id: "sloc_1",
              stocked_quantity: 4,
              reserved_quantity: 0,
            },
          ],
        },
      ],
    })

    expect(classifyVariant(located, 3, none)?.row.location_id).toBe("sloc_1")
  })

  it("reports sold out separately from low", () => {
    expect(classifyVariant(withStock(0), 3, none)?.bucket).toBe("out")
    // Fully reserved is sold out too — nothing left to sell.
    expect(classifyVariant(withStock(2, 2), 3, none)?.bucket).toBe("out")
  })

  it("never flags a negative availability as merely low", () => {
    expect(classifyVariant(withStock(1, 4), 3, none)?.bucket).toBe("out")
  })

  it("sums levels across locations", () => {
    const multiLocation = variant({
      inventory: [
        {
          id: "iitem_1",
          metadata: null,
          location_levels: [
            { stocked_quantity: 1, reserved_quantity: 0 },
            { stocked_quantity: 1, reserved_quantity: 1 },
          ],
        },
      ],
    })

    expect(classifyVariant(multiLocation, 3, none)?.row.available).toBe(1)
  })

  it("reads bigNumber-shaped quantities", () => {
    const boxed = variant({
      inventory: [
        {
          id: "iitem_1",
          metadata: null,
          location_levels: [
            {
              stocked_quantity: { value: "5" },
              reserved_quantity: { value: "3" },
            },
          ],
        },
      ],
    })

    expect(classifyVariant(boxed, 3, none)?.row.available).toBe(2)
  })

  it("applies the per-item override instead of the default", () => {
    const result = classifyVariant(
      withStock(6, 0, { low_stock_threshold: 8 }),
      3,
      none
    )

    expect(result?.bucket).toBe("low")
    expect(result?.row.threshold).toBe(8)
    expect(result?.row.has_custom_threshold).toBe(true)
  })

  it("skips variants that do not track stock", () => {
    expect(
      classifyVariant(variant({ manage_inventory: false }), 3, none)
    ).toBeNull()
  })

  it("skips made-to-order variants even when they track stock", () => {
    // A commissioned piece is made after it is ordered, so zero available is
    // its normal state — warning about it would be noise every single day.
    const excluded = new Set(["variant_1"])

    expect(classifyVariant(withStock(0), 3, excluded)).toBeNull()
  })

  it("skips variants with no inventory item at all", () => {
    expect(classifyVariant(variant({ inventory: [] }), 3, none)).toBeNull()
  })
})
