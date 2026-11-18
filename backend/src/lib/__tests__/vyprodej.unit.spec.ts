import {
  parseVyprodej,
  resolveVyprodejMembers,
  vyprodejDescription,
  type VyprodejConfig,
} from "../vyprodej-config"

const base: VyprodejConfig = {
  type: "time",
  percent: 20,
  collection_ids: [],
  category_ids: [],
  product_ids: [],
  excluded_product_ids: [],
  members: [],
}

const categories = new Map([
  ["cat_kvetinace", { parent_id: null, collection_id: "col_zahrada" }],
  ["cat_male", { parent_id: "cat_kvetinace", collection_id: null }],
  ["cat_hrnky", { parent_id: null, collection_id: "col_kuchyn" }],
])

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: "published",
  collection_id: null as string | null,
  category_ids: [] as string[],
  metadata: {} as Record<string, unknown>,
  variants: [{ id: `${id}_v`, manage_inventory: true }],
  ...extra,
})

const products = [
  product("p_kvet", { category_ids: ["cat_kvetinace"] }),
  product("p_maly", { category_ids: ["cat_male"] }),
  product("p_hrnek", { category_ids: ["cat_hrnky"] }),
  product("p_kolekce", { collection_id: "col_zahrada" }),
  product("p_poukaz", { category_ids: ["cat_kvetinace"], metadata: { gift_voucher: true } }),
  product("p_poskozeny", { category_ids: ["cat_kvetinace"], metadata: { clearance: true } }),
  product("p_koncept", { category_ids: ["cat_kvetinace"], status: "draft" }),
]

const available = new Map([
  ["p_kvet_v", 3],
  ["p_maly_v", 0],
  ["p_hrnek_v", 2],
  ["p_kolekce_v", 1],
])

describe("výprodej — popis ceníku", () => {
  it("zapíše a přečte nastavení", () => {
    const config = { ...base, category_ids: ["cat_hrnky"], members: ["p_hrnek"] }
    expect(parseVyprodej(vyprodejDescription(config))).toEqual(config)
  })

  it("cizí popis není výprodej", () => {
    expect(parseVyprodej("kz:product-sale:prod_1:20")).toBeNull()
    expect(parseVyprodej("kz:vyprodej:{nejson")).toBeNull()
    expect(parseVyprodej(null)).toBeNull()
  })
})

describe("výprodej — které výrobky", () => {
  const ctx = { categories, available, takenByOther: new Set<string>() }

  it("kolekce = výrobky kolekce i jejích kategorií (i podkategorií)", () => {
    const r = resolveVyprodejMembers(products, { ...base, collection_ids: ["col_zahrada"] }, ctx)
    expect(r.productIds.sort()).toEqual(["p_kolekce", "p_kvet", "p_maly"])
  })

  it("kategorie, výrobky a vyřazené", () => {
    const r = resolveVyprodejMembers(
      products,
      {
        ...base,
        category_ids: ["cat_kvetinace"],
        product_ids: ["p_hrnek"],
        excluded_product_ids: ["p_maly"],
      },
      ctx
    )
    expect(r.productIds.sort()).toEqual(["p_hrnek", "p_kvet"])
  })

  it("poukaz, poškozený kus a koncept nikdy", () => {
    const r = resolveVyprodejMembers(products, { ...base, category_ids: ["cat_kvetinace"] }, ctx)
    expect(r.productIds).not.toContain("p_poukaz")
    expect(r.productIds).not.toContain("p_poskozeny")
    expect(r.productIds).not.toContain("p_koncept")
    expect(r.skipped.nelze).toBe(2)
  })

  it("výrobek v jiném výprodeji se nebere", () => {
    const r = resolveVyprodejMembers(
      products,
      { ...base, category_ids: ["cat_kvetinace"] },
      { ...ctx, takenByOther: new Set(["p_kvet"]) }
    )
    expect(r.productIds).toEqual(["p_maly"])
    expect(r.skipped.jinyVyprodej).toBe(1)
  })

  it("do vyprodání zásob: jen provedení se skladem", () => {
    const r = resolveVyprodejMembers(
      products,
      { ...base, type: "stock", collection_ids: ["col_zahrada"] },
      ctx
    )
    expect(r.productIds.sort()).toEqual(["p_kolekce", "p_kvet"])
    expect(r.variantIds.sort()).toEqual(["p_kolekce_v", "p_kvet_v"])
    expect(r.skipped.vyprodano).toBe(1)
  })
})
