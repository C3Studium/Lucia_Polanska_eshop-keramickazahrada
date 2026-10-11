import type { HttpTypes } from "@medusajs/types"
import type { ReactNode } from "react"

export type ShopSort = "featured" | "newest" | "price-asc" | "price-desc"

/**
 * Pseudo-kategorie podle druhu kusu — ne skutečná kategorie z backendu, jen
 * filtr nad daty, která produkt už nese: balíček (`product.bundle`), poškozený
 * (`metadata.clearance`), zakázka (`metadata.made_to_order`). Vzájemně výlučné;
 * "" = bez omezení.
 */
export type ShopKind = "" | "clearance" | "bundle" | "madeToOrder"

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

/**
 * Režim výběru — týž výpis jako obchod, ale jako mini obchod uvnitř úpravy
 * objednávky (`/order/:id/edit/pridat`). Nestaví se druhý obchod: výpis jen
 * ukáže povolené produkty, schová košík a oblíbené na kartách, karta vede na
 * stránku produktu v režimu výběru a z filtrů zůstane hledání a kategorie.
 */
export type ShopPickMode = {
  /** Hlavička výpisu — jiná pro přidání kusu a pro výměnu řádku za jiný
      výrobek, a obojí jiná než u obchodu. */
  intro: {
    /** Řádek nad nadpisem („Přidat k objednávce #39"). */
    eyebrow: string
    title: string
    /** Kurzívou na druhém řádku nadpisu. */
    accent: string
    text: string
  }
  /** Jediné produkty, které výpis ukáže — `allowed` z katalogu úpravy. */
  productIds: string[]
  /** Kam vede karta produktu (bez kódu země) místo běžné stránky produktu. */
  productHref: (product: HttpTypes.StoreProduct) => string
  /** Lišta nad výpisem („Vybíráte do objednávky #N · Zpět na úpravu"). */
  banner?: ReactNode
}
