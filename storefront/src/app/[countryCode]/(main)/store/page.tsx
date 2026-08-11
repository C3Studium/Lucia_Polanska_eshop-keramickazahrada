import { Metadata } from "next"

import ECom from "@modules/store/Shop"
import type { ShopFilters } from "@modules/store/Shop/types"
import { listStoreCatalogue } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { getCollectionByHandle, listCollections } from "@lib/data/collections"

type StorePageProps = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{
    category?: string
    collection?: string
    search?: string
  }>
}

export const metadata: Metadata = {
  title: "Obchod",
  description:
    "Keramika z ateliéru Lucie Polanské — pro zahradu i domov. Každý kus je dělaný rukama a je jen jeden.",
}

const defaultFilters: ShopFilters = {
  categoryId: "",
  collectionId: "",
  isNew: false,
  onSale: false,
  priceRange: "",
  search: "",
  sort: "featured",
}

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const [{ countryCode }, query] = await Promise.all([params, searchParams])

  const categories = await listCategories({
    fields: "id,name,handle,metadata,*products",
    limit: 100,
  })

  const { collections: allCollections } = await listCollections({
    fields: "id,title,handle,metadata,*products",
  }).catch(() => ({ collections: [] as any[], count: 0 }))

  // Kolekce skryté očkem v adminu (metadata.hidden) do nabídky nepatří.
  const navCollections = allCollections
    .filter((collection: any) => !(collection.metadata as any)?.hidden)
    .map((collection: any) => {
    const productIds = new Set(
      (collection.products ?? []).map(({ id }: any) => id)
    )
      return {
        id: collection.id,
        title: collection.title,
        categories: categories.filter(
          (category: any) =>
            category.products?.some(({ id }: any) => productIds.has(id)) ||
            (category.metadata as any)?.collection_id === collection.id
        ),
      }
    })

  const category = query.category
    ? categories.find((item) => item.handle === query.category)
    : undefined

  const collection = query.collection
    ? await getCollectionByHandle(query.collection).catch(() => undefined)
    : undefined

  const initialFilters: ShopFilters = {
    ...defaultFilters,
    categoryId: category?.id ?? "",
    collectionId: collection?.id ?? "",
    search: query.search?.trim() ?? "",
  }

  const { products, count } = await listStoreCatalogue({
    filters: initialFilters,
    limit: 16,
    countryCode,
  })

  return (
    <ECom
      key={`${initialFilters.categoryId}:${initialFilters.collectionId}:${initialFilters.search}`}
      countryCode={countryCode}
      products={products}
      categories={categories}
      navCollections={navCollections}
      totalCount={count}
      initialFilters={initialFilters}
      initialFilterLabel={category?.name ?? collection?.title}
    />
  )
}
