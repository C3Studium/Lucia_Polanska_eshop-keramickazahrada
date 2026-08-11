import { HttpTypes } from "@medusajs/types"

import type {
  NavigationCategory,
  NavigationCollection,
} from "@modules/layout/Navbar/productsButton"

import { listCategories } from "./categories"
import { listCollections } from "./collections"

/** The mega-menu lays out expanding cards; more than six stop being readable. */
const CARD_LIMIT = 6
const CATEGORY_LINK_LIMIT = 6
const FALLBACK_IMAGE = "/assets/img/img/home_image.png"

/**
 * TODO(backend): delete this set — and the `.filter()` that uses it — once the new Medusa
 * admin work is finished and the starter seed data is removed from the catalogue.
 *
 * These four categories ship with the Medusa starter (one demo apparel product each). They
 * are English clothing on a Czech ceramics store, so they must not reach the Produkty menu
 * while they still exist in the backend. This is the only place the catalogue is filtered
 * by hand; when the seed data is gone, this constant becomes dead and should go with it.
 * The demo products themselves are still reachable in /store — that cleanup is backend-side.
 */
const SEED_CATEGORY_HANDLES = new Set(["shirts", "sweatshirts", "pants", "merch"])

/**
 * Builds the Produkty mega-menu from real catalogue data.
 *
 * Collections are the intended top level: one card per collection, its categories as the
 * links inside. The catalogue currently has no collections, so the top-level categories take
 * the cards instead and their child categories become the links. Either way every card and
 * every link points at a real, populated destination — the menu never invents one.
 */
export const listNavigationCollections = async (): Promise<
  NavigationCollection[]
> => {
  const [collectionResult, categories] = await Promise.all([
    listCollections({ fields: "*products" }).catch(() => ({
      collections: [],
      count: 0,
    })),
    listCategories({ limit: 100, fields: "id,name,handle,metadata,*products" }).catch(() => []),
  ])

  return collectionResult.collections.length
    ? toCollectionCards(collectionResult.collections, categories)
    : toCategoryCards(categories)
}

function toCollectionCards(
  collections: HttpTypes.StoreCollection[],
  categories: HttpTypes.StoreProductCategory[]
): NavigationCollection[] {
  return collections.slice(0, CARD_LIMIT).map((collection) => {
    const productIds = new Set(collection.products?.map(({ id }) => id) ?? [])

    return {
      id: collection.id,
      title: collection.title,
      href: catalogueHref("collection", collection.handle),
      image: imageFor(collection.metadata, collection.products),
      productCount: collection.products?.length ?? 0,
      categories: categories
        .filter(
          (category) =>
            // Buď má v kolekci produkty, nebo je do ní zařazená ručně přes
            // metadata.collection_id (vazba z admin Rozdělení) — díky tomu
            // se v menu ukáže i čerstvě založená prázdná kategorie.
            category.products?.some(({ id }) => productIds.has(id)) ||
            (category.metadata as Record<string, unknown> | null)
              ?.collection_id === collection.id
        )
        .slice(0, CATEGORY_LINK_LIMIT)
        .map(toNavigationCategory),
    }
  })
}

function toCategoryCards(
  categories: HttpTypes.StoreProductCategory[]
): NavigationCollection[] {
  return categories
    .filter((category) => !category.parent_category_id)
    .filter((category) => !SEED_CATEGORY_HANDLES.has(category.handle ?? ""))
    // A card the customer can open onto an empty grid is a dead end, not a destination.
    .filter((category) => (category.products?.length ?? 0) > 0)
    .slice(0, CARD_LIMIT)
    .map((category) => ({
      id: category.id,
      title: category.name,
      href: catalogueHref("category", category.handle),
      image: imageFor(category.metadata, category.products),
      productCount: category.products?.length ?? 0,
      categories: (category.category_children ?? [])
        .slice(0, CATEGORY_LINK_LIMIT)
        .map(toNavigationCategory),
    }))
}

function toNavigationCategory(
  category: HttpTypes.StoreProductCategory
): NavigationCategory {
  return {
    id: category.id,
    name: category.name,
    href: catalogueHref("category", category.handle),
  }
}

/**
 * `/store` filters on `?category=` and `?collection=` by handle, and resolves each against a
 * different backend lookup — so the parameter has to match what the entry actually is.
 */
function catalogueHref(
  kind: "category" | "collection",
  handle: string | null | undefined
) {
  return handle ? `/store?${kind}=${encodeURIComponent(handle)}` : "/store"
}

/** An editor-set `metadata.image` wins; otherwise the first product that has a thumbnail. */
function imageFor(
  metadata: Record<string, unknown> | null | undefined,
  products: HttpTypes.StoreProduct[] | undefined
) {
  const editorImage = metadata?.image

  if (typeof editorImage === "string" && editorImage) {
    return editorImage
  }

  return products?.find((product) => product.thumbnail)?.thumbnail ?? FALLBACK_IMAGE
}
