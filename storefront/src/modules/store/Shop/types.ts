import type { HttpTypes } from "@medusajs/types"

export type ShopSort = "featured" | "newest" | "price-asc" | "price-desc"

/**
 * Pseudo-kategorie podle druhu kusu — ne skutečná kategorie z backendu, jen
 * filtr nad daty, která produkt už nese: balíček (`product.bundle`), poškozený
 * (`metadata.clearance`). Vzájemně výlučné; "" = bez omezení.
 */
export type ShopKind = "" | "clearance" | "bundle"

export type ShopFilters = {
  categoryId: string
  collectionId: string
  isNew: boolean
  onSale: boolean
  kind: ShopKind
  priceRange: string
  search: string
  sort: ShopSort
}

export type ShopCategory = Pick<HttpTypes.StoreProductCategory, "id" | "name"> & {
  products?: HttpTypes.StoreProduct[] | null
}

export type FilterChip = {
  id: string
  label: string
  onRemove: () => void
}

export type ShopNavCollection = {
  id: string
  title: string
  categories: ShopCategory[]
}
