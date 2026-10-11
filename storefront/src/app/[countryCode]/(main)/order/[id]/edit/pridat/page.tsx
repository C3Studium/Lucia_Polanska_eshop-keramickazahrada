import { Metadata } from "next"

import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import {
  getGuestOrderEditCatalog,
  getGuestOrderEditContext,
} from "@lib/data/guest-order-edit"
import { listStoreCatalogue } from "@lib/data/products"
import OrderPickShop from "@modules/order/components/order-edit/pick-shop"
import { editPath } from "@modules/order/components/order-edit/shared"
import OrderStateShell from "@modules/order/components/order-state-shell"
import type { ShopFilters, ShopNavCollection } from "@modules/store/Shop/types"

type Props = {
  params: Promise<{ id: string; countryCode: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Přidat k objednávce",
  description: "Vyberte, co k objednávce přidat.",
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
 * Mini obchod úpravy objednávky (plán §3c bod 2): stávající výpis obchodu
 * v režimu výběru, jen produkty, které server dovolí přidat (`allowed`
 * z `GET …/guest-edit/catalog`). Hledání a kategorie, bez filtrů. Klik na
 * produkt vede na jeho stránku v režimu výběru (`./[handle]`).
 */
export default async function OrderEditPickPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const [context, catalog] = token
    ? await Promise.all([
        getGuestOrderEditContext(params.id, token),
        getGuestOrderEditCatalog(params.id, token),
      ])
    : [null, null]

  if (!token || !context || !catalog) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker="Přidat k objednávce"
        title="Odkaz nejde otevřít."
        description="Odkaz je neplatný nebo vypršel. Otevřete prosím úpravu objednávky z posledního e-mailu, nebo se nám ozvěte a doplníme to spolu."
        status="pending"
      />
    )
  }

  /* Server je soudce: katalog říká, jestli jde přidávat. Čekající změna
     (platba rozdílu) navíc blokuje každé další uložení, takže vybírat teď
     nemá smysl. */
  if (!catalog.can_add || context.pending_change) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker={`Objednávka #${context.order.display_id}`}
        title="Teď přidat nejde."
        description={
          context.pending_change
            ? "K objednávce čeká úprava na zaplacení rozdílu. Dokončete ji, nebo ji na stránce úpravy zrušte — pak můžete přidávat."
            : catalog.reason ??
              context.reason ??
              "K téhle objednávce už nic přidat nejde. Kdybyste něco potřebovali, napište nám na info@keramickazahrada.cz."
        }
        status="pending"
        primary={{ href: editPath(params.id, token), label: "Zpět na úpravu" }}
      />
    )
  }

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

  /* Kategorie a kolekce jen s něčím, co jde přidat — jinak by zákazník klikal
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
      token={token}
      orderNumber={context.order.display_id}
      productIds={productIds}
      countryCode={params.countryCode}
      products={initial.products}
      totalCount={initial.count}
      categories={pickCategories}
      navCollections={navCollections}
    />
  )
}
