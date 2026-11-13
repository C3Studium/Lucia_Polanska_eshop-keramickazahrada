import { test } from "node:test"
import assert from "node:assert/strict"
import { filterCatalogue, type CatalogueItem } from "../catalogue-filter"

const DEN = 86400000
const ted = Date.parse("2026-11-13T12:00:00Z")
const p = (id: string, extra: Partial<CatalogueItem> = {}): CatalogueItem => ({
  id,
  created_at: new Date(ted - 100 * DEN).toISOString(),
  categories: [],
  collection_id: null,
  metadata: null,
  ...extra,
})
const ceny: Record<string, { price: number; sale: boolean }> = {
  a: { price: 300, sale: false },
  b: { price: 1200, sale: true },
  c: { price: 700, sale: false },
  d: { price: 3000, sale: false },
}
const ctx = { now: ted, priceOf: (x: CatalogueItem) => ceny[x.id] ?? null, collectionCategoryIds: [] as string[] }
const prazdne = { categoryId: "", collectionId: "", isNew: false, onSale: false, kind: "", priceRange: "", search: "", sort: "featured" }
const vse = [
  p("a", { categories: [{ id: "kv" }], collection_id: "zahrada" }),
  p("b", { categories: [{ id: "byt" }], created_at: new Date(ted - 5 * DEN).toISOString(), metadata: { clearance: true } }),
  p("c", { categories: [{ id: "kv" }, { id: "byt" }], metadata: { made_to_order: true } }),
  p("d", { collection_id: "zahrada", metadata: { is_bundle: true } }),
]
const ids = (r: { products: CatalogueItem[] }) => r.products.map((x) => x.id).join("")

test("bez filtrů vrátí vše v původním pořadí", () => {
  assert.equal(ids(filterCatalogue(vse, prazdne, ctx)), "abcd")
  assert.equal(filterCatalogue(vse, prazdne, ctx).count, 4)
})
test("kategorie podle kterékoli kategorie výrobku", () => {
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, categoryId: "kv" }, ctx)), "ac")
})
test("kolekce = vlastní kolekce NEBO kategorie kolekce", () => {
  const r = filterCatalogue(vse, { ...prazdne, collectionId: "zahrada" }, { ...ctx, collectionCategoryIds: ["byt"] })
  assert.equal(ids(r), "abcd")
})
test("vybraná kategorie má přednost před kolekcí", () => {
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, collectionId: "zahrada", categoryId: "byt" }, ctx)), "bc")
})
test("novinky = posledních 30 dní", () => {
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, isNew: true }, ctx)), "b")
})
test("sleva, druh a cena", () => {
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, onSale: true }, ctx)), "b")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, kind: "clearance" }, ctx)), "b")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, kind: "bundle" }, ctx)), "d")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, kind: "madeToOrder" }, ctx)), "c")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, priceRange: "500-1000" }, ctx)), "c")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, priceRange: "2500+" }, ctx)), "d")
})
test("řazení podle ceny a nejnovější", () => {
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, sort: "price-asc" }, ctx)), "acbd")
  assert.equal(ids(filterCatalogue(vse, { ...prazdne, sort: "price-desc" }, ctx)), "dbca")
  assert.equal(filterCatalogue(vse, { ...prazdne, sort: "newest" }, ctx).products[0].id, "b")
})
test("stránkování a jen povolené", () => {
  const r = filterCatalogue(vse, prazdne, { ...ctx, offset: 1, limit: 2 })
  assert.equal(ids(r), "bc")
  assert.equal(r.count, 4)
  assert.equal(ids(filterCatalogue(vse, prazdne, { ...ctx, onlyIds: new Set(["a", "d"]) })), "ad")
})
