import { categoriesForCollection, type Category } from "../components/classification-draft"

/*
 * Kategorie pod kolekcí v Rozdělení (21. 11. 2026) — stejné pravidlo jako
 * menu obchodu: přiřazené kolekci, k tomu nepřiřazené, které mají její
 * výrobky. Kategorie JINÉ kolekce sem nepatří, i když ji má výrobek
 * („Přidat i sem"): dřív se tak „Drobné radosti" z Do bytu ukazovaly i pod
 * kolekcí Drobné radosti a kategorie zlevněných kusů pod Výrobky se slevou.
 */
const all: Category[] = [
  { id: "ptacci", name: "Ptáčci", metadata: { collection_id: "radosti" } },
  { id: "drobne", name: "Drobné radosti", metadata: { collection_id: "byt" } },
  { id: "vypoukla", name: "Vypouklá", metadata: { collection_id: "zvonky" } },
  { id: "stara", name: "Bez kolekce", metadata: {} },
]
const ids = (list: Category[]) => list.map((c) => c.id).sort()

describe("kategorie kolekce v Rozdělení", () => {
  it("kategorie cizí kolekce se pod kolekcí neukáže, i když ji výrobek má", () => {
    const products = [{ collection_id: "radosti", category_refs: [{ id: "ptacci" }, { id: "drobne" }] }]
    expect(ids(categoriesForCollection("radosti", products, all))).toEqual(["ptacci"])
    expect(ids(categoriesForCollection("byt", products, all))).toEqual(["drobne"])
  })

  it("Výrobky se slevou bez vlastních kategorií neukážou kategorie zlevněných kusů", () => {
    const products = [{ collection_id: "sleva", category_refs: [{ id: "vypoukla" }] }]
    expect(categoriesForCollection("sleva", products, all)).toEqual([])
  })

  it("nepřiřazená kategorie se ukáže tam, kde má výrobky", () => {
    const products = [{ collection_id: "sleva", category_refs: [{ id: "stara", name: "Bez kolekce" }] }]
    expect(ids(categoriesForCollection("sleva", products, all))).toEqual(["stara"])
  })

  it("prázdná přiřazená kategorie se ukáže (jde do ní řadit)", () => {
    expect(ids(categoriesForCollection("zvonky", [], all))).toEqual(["vypoukla"])
  })
})
