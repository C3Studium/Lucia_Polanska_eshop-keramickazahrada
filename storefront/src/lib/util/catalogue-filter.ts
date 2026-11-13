/**
 * Filtry obchodu nad celým katalogem v paměti (13. 11. 2026).
 *
 * Dřív šel každý klik na filtr na backend — a protože cena, druh kusu
 * a kolekce přes kategorie se stejně skládaly lokálně, stahoval se pokaždé
 * celý katalog znovu. Naměřeno 1,2–2,6 s na klik. Teď se katalog stáhne
 * jednou (krátce kešovaný, viz `listStoreCatalogue`) a filtruje se tady.
 *
 * Čistá funkce bez Medusy a bez Nextu — cenu dodává volající (`priceOf`),
 * takže jde testovat a nezávisí na regionu.
 */

export type CatalogueItem = {
  id: string
  created_at?: string | Date | null
  categories?: { id: string }[] | null
  collection_id?: string | null
  metadata?: Record<string, unknown> | null
}

export type CatalogueFilters = {
  categoryId: string
  collectionId: string
  isNew: boolean
  onSale: boolean
  kind?: string
  priceRange: string
  search?: string
  sort: string
}

export type CatalogueContext<T extends CatalogueItem> = {
  /** Nejnižší cena výrobku v regionu a jestli je akční; `null` = bez ceny. */
  priceOf: (item: T) => { price: number; sale: boolean } | null
  /** Kategorie patřící vybrané kolekci (`category.metadata.collection_id`). */
  collectionCategoryIds?: string[]
  /** Jen tyto výrobky (mini obchod úpravy objednávky). */
  onlyIds?: Set<string> | null
  now?: number
  offset?: number
  limit?: number
}

const NOVINKA_DNI = 30

export const parsePriceRange = (
  value: string
): { min: number; max: number } | null => {
  if (!value) return null
  const open = value.match(/^(\d+)\+$/)
  if (open) return { min: Number(open[1]), max: Number.POSITIVE_INFINITY }
  const pair = value.match(/^(\d+)-(\d+)$/)
  if (pair) return { min: Number(pair[1]), max: Number(pair[2]) }
  return null
}

const casVytvoreni = (item: CatalogueItem) =>
  new Date(item.created_at ?? 0).getTime()

export const filterCatalogue = <T extends CatalogueItem>(
  all: T[],
  filters: CatalogueFilters,
  ctx: CatalogueContext<T>
): { products: T[]; count: number } => {
  const now = ctx.now ?? Date.now()
  const range = parsePriceRange(filters.priceRange)
  const kolekceKategorie = new Set(ctx.collectionCategoryIds ?? [])

  const vysledek = all.filter((item) => {
    if (ctx.onlyIds && !ctx.onlyIds.has(item.id)) return false

    const kategorie = item.categories ?? []
    /* Vybraná kategorie je užší výběr než kolekce — rozhoduje sama. */
    if (filters.categoryId) {
      if (!kategorie.some((c) => c.id === filters.categoryId)) return false
    } else if (filters.collectionId) {
      const vlastni = item.collection_id === filters.collectionId
      const pres = kategorie.some((c) => kolekceKategorie.has(c.id))
      if (!vlastni && !pres) return false
    }

    if (filters.isNew && casVytvoreni(item) < now - NOVINKA_DNI * 86400000) {
      return false
    }

    const meta = item.metadata ?? null
    if (filters.kind === "bundle" && meta?.is_bundle !== true) return false
    if (filters.kind === "clearance" && meta?.clearance !== true) return false
    if (filters.kind === "madeToOrder" && meta?.made_to_order !== true) return false

    if (range || filters.onSale) {
      const cena = ctx.priceOf(item)
      if (range && (!cena || cena.price < range.min || cena.price > range.max)) {
        return false
      }
      if (filters.onSale && !cena?.sale) return false
    }

    return true
  })

  if (filters.sort === "price-asc" || filters.sort === "price-desc") {
    const smer = filters.sort === "price-asc" ? 1 : -1
    vysledek.sort((a, b) => {
      const pa = ctx.priceOf(a)?.price
      const pb = ctx.priceOf(b)?.price
      /* Bez ceny vždy na konec, ať se řadí kterýmkoli směrem. */
      if (typeof pa !== "number") return typeof pb === "number" ? 1 : 0
      if (typeof pb !== "number") return -1
      return (pa - pb) * smer
    })
  } else if (filters.sort === "newest") {
    vysledek.sort((a, b) => casVytvoreni(b) - casVytvoreni(a))
  }

  const offset = Math.max(ctx.offset ?? 0, 0)
  const limit = ctx.limit ?? vysledek.length
  return { products: vysledek.slice(offset, offset + limit), count: vysledek.length }
}
