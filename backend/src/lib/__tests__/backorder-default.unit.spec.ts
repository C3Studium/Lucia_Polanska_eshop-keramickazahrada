import {
  excludedProductCount,
  isBackorderEligible,
  noBackorderExclusions,
  variantIdsMissingBackorder,
  type BackorderExclusions,
} from "../backorder-default"

const exclusions = (
  overrides: Partial<{
    production: string[]
    bundles: string[]
  }> = {}
): BackorderExclusions => ({
  productionProductIds: new Set(overrides.production ?? []),
  bundleProductIds: new Set(overrides.bundles ?? []),
})

const product = (id: string, variants: any[], metadata: any = null) => ({
  id,
  metadata,
  variants,
})

describe("isBackorderEligible", () => {
  it("accepts an ordinary catalog product", () => {
    expect(isBackorderEligible(product("prod_1", []))).toBe(true)
  })

  it("skips a výprodej piece — there is no second one to make", () => {
    expect(
      isBackorderEligible(product("prod_1", [], { clearance: true }))
    ).toBe(false)
  })

  it("skips a product the zakázka flow owns", () => {
    expect(
      isBackorderEligible(
        product("prod_1", []),
        exclusions({ production: ["prod_1"] })
      )
    ).toBe(false)
  })

  it("skips a bundle composite — stock lives in its components", () => {
    expect(
      isBackorderEligible(
        product("prod_1", []),
        exclusions({ bundles: ["prod_1"] })
      )
    ).toBe(false)
  })
})

describe("variantIdsMissingBackorder", () => {
  it("returns only the variants that are actually wrong", () => {
    const ids = variantIdsMissingBackorder(
      [
        product("prod_1", [
          { id: "var_1", allow_backorder: false },
          { id: "var_2", allow_backorder: true },
          { id: "var_3" },
        ]),
      ],
      noBackorderExclusions
    )

    expect(ids).toEqual(["var_1", "var_3"])
  })

  it("is empty for an already-correct product, so no write happens", () => {
    const ids = variantIdsMissingBackorder([
      product("prod_1", [{ id: "var_1", allow_backorder: true }]),
    ])

    expect(ids).toEqual([])
  })

  it("leaves excluded products alone even when their variants are wrong", () => {
    const ids = variantIdsMissingBackorder(
      [
        product("prod_clearance", [{ id: "var_1", allow_backorder: false }], {
          clearance: true,
        }),
        product("prod_zakazka", [{ id: "var_2", allow_backorder: false }]),
        product("prod_bundle", [{ id: "var_3", allow_backorder: false }]),
        product("prod_normal", [{ id: "var_4", allow_backorder: false }]),
      ],
      exclusions({ production: ["prod_zakazka"], bundles: ["prod_bundle"] })
    )

    expect(ids).toEqual(["var_4"])
  })

  it("survives a product with no variants and a missing list", () => {
    expect(
      variantIdsMissingBackorder([
        product("prod_1", []),
        { id: "prod_2" } as any,
      ])
    ).toEqual([])
  })
})

describe("excludedProductCount", () => {
  it("counts the products skipped on purpose", () => {
    const count = excludedProductCount(
      [
        product("prod_clearance", [], { clearance: true }),
        product("prod_zakazka", []),
        product("prod_normal", []),
      ],
      exclusions({ production: ["prod_zakazka"] })
    )

    expect(count).toBe(2)
  })
})
