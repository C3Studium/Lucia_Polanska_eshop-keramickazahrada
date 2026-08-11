import type { HttpTypes } from "@medusajs/types"

export type ShopSort = "featured" | "newest" | "price-asc" | "price-desc"

export type ShopFilters = {
  categoryId: string
  collectionId: string
  isNew: boolean
  onSale: boolean
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
