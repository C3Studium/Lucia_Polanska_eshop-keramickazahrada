import {
  applyBulkClassification,
  bulkClassificationDirty,
  sortDraft,
  type Category,
} from "../components/classification-draft"

const categories: Category[] = [
  { id: "plocha", name: "Plochá", metadata: { collection_id: "zvonky" } },
  { id: "vypoukla", name: "Vypouklá", metadata: { collection_id: "zvonky" } },
  { id: "pitka", name: "Pítka a krmítka", metadata: { collection_id: "zahrada" } },
]

describe("přeřazení — Přesunout sem", () => {
  it("výrobky budou jen v cílové kolekci a vybraných kategoriích", () => {
    const products = [
      { collection_id: "sleva", category_ids: ["pitka", "vypoukla"] },
      { collection_id: "zahrada", category_ids: ["pitka"] },
    ]
    const draft = sortDraft("move", "zvonky", ["plocha"], products)
    expect(products.map((product) => applyBulkClassification(product, draft, categories))).toEqual([
      { collection_id: "zvonky", category_ids: ["plocha"] },
      { collection_id: "zvonky", category_ids: ["plocha"] },
    ])
  })

  it("do kolekce bez kategorií = jen hlavní kolekce, kategorie pryč", () => {
    const draft = sortDraft("move", "sleva", [], [{ category_ids: ["pitka"] }])
    expect(applyBulkClassification({ collection_id: "zahrada", category_ids: ["pitka"] }, draft, categories)).toEqual({
      collection_id: "sleva",
      category_ids: [],
    })
  })
})

describe("přeřazení — Přidat i sem", () => {
  it("nic se nebere, kategorie přibude; hlavní kolekce zůstává", () => {
    const draft = sortDraft("add", "zvonky", ["vypoukla"], [])
    expect(applyBulkClassification({ collection_id: "zahrada", category_ids: ["pitka"] }, draft, categories)).toEqual({
      collection_id: "zahrada",
      category_ids: ["pitka", "vypoukla"],
    })
  })

  it("nezařazený výrobek dostane cíl jako hlavní kolekci", () => {
    const draft = sortDraft("add", "zvonky", [], [])
    expect(applyBulkClassification({ collection_id: null, category_ids: [] }, draft, categories)).toEqual({
      collection_id: "zvonky",
      category_ids: [],
    })
  })
})

describe("bez cíle", () => {
  it("žádná změna", () => {
    expect(bulkClassificationDirty(sortDraft("move", null, [], [{ category_ids: ["pitka"] }]))).toBe(false)
  })
})
