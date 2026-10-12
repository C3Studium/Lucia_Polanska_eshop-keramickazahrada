import { Metadata } from "next"
import { redirect } from "next/navigation"

import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { listStoreCatalogue } from "@lib/data/products"
import { resolvePickAccess } from "@modules/order/components/order-edit/pick-access"
import OrderPickShop from "@modules/order/components/order-edit/pick-shop"
import {
  editPath,
  ORDER_ITEM_EDITING_ENABLED,
} from "@modules/order/components/order-edit/shared"
import type { ShopFilters, ShopNavCollection } from "@modules/store/Shop/types"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string; swap?: string }>
}

export const metadata: Metadata = {
  title: "Výběr do objednávky",
  description: "Vyberte, co k objednávce přidat nebo za co vyměnit.",
  robots: { index: false, follow: false },
}

const defaultFilters: ShopFilters = {
  categoryId: "",
  collectionId: "",
  isNew: false,
  onSale: false,
  kind: "",
  priceRange: "",
  search: "",
  sort: "featured",
}

/**
 * Mini obchod úpravy objednávky (plán §3c bod 2, §3d bod 10): stávající
 * výpis obchodu v režimu výběru, jen produkty, které server dovolí (`allowed`
 * z `GET …/guest-edit/catalog`). Bez `swap` se vybírá kus navíc, se
 * `swap=<item_id>` náhrada za ten řádek (nabídku zúží server). Hledání
 * a kategorie, bez filtrů. Klik na produkt vede na jeho stránku v režimu
 * výběru (`./[handle]`).
 *
 * 12. 10. 2026, Matěj: mini obchod je vypnutý (`ORDER_ITEM_EDITING_ENABLED`,
 * vysvětlení v `order-edit/shared.ts`) — stará adresa (historie prohlížeče,
 * záložka) přesměruje zpátky na stránku úpravy. Kód stránky zůstává.
 */
export default async function OrderEditPickPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  if (!ORDER_ITEM_EDITING_ENABLED) {
    redirect(
      searchParams.token
        ? `/${params.countryCode}${editPath(params.id, searchParams.token)}`
        : `/${params.countryCode}/order/${params.id}/edit`
    )
  }
  const access = await resolvePickAccess(
    params.id,
    searchParams.token,
    searchParams.swap
  )
  if (!access.ok) return access.view
  const { catalog } = access

  const productIds = Object.keys(catalog.allowed).filter(
    (productId) => (catalog.allowed[productId] ?? []).length > 0
  )
  const allowed = new Set(productIds)
  const hasAllowed = (products?: { id: string }[] | null) =>
    (products ?? []).some((product) => allowed.has(product.id))

  const [categories, { collections }, initial] = await Promise.all([
    listCategories({ fields: "id,name,handle,metadata,*products", limit: 100 }),
    listCollections({ fields: "id,title,handle,metadata,*products" }).catch(
      () => ({ collections: [] as any[], count: 0 })
    ),
    listStoreCatalogue({
      filters: defaultFilters,
      limit: 16,
      countryCode: params.countryCode,
      onlyProductIds: productIds,
    }),
  ])

  /* Kategorie a kolekce jen s něčím, co jde vybrat — jinak by zákazník klikal
     do prázdných výpisů. Skládá se stejně jako v obchodě (`/store`). */
  const pickCategories = categories.filter((category) =>
    hasAllowed(category.products)
  )
  const navCollections: ShopNavCollection[] = collections
    .filter(
      (collection: any) =>
        !(collection.metadata as any)?.hidden && hasAllowed(collection.products)
    )
    .map((collection: any) => {
      const productIdsInCollection = new Set(
        (collection.products ?? []).map(({ id }: any) => id)
      )
      return {
        id: collection.id,
        title: collection.title,
        categories: pickCategories.filter(
          (category: any) =>
            category.products?.some(({ id }: any) =>
              productIdsInCollection.has(id)
            ) || (category.metadata as any)?.collection_id === collection.id
        ),
      }
    })

  return (
    <OrderPickShop
      orderId={params.id}
      token={access.token}
      orderNumber={access.orderNumber}
      swap={access.swap}
      productIds={productIds}
      countryCode={params.countryCode}
      products={initial.products}
      totalCount={initial.count}
      categories={pickCategories}
      navCollections={navCollections}
    />
  )
}
