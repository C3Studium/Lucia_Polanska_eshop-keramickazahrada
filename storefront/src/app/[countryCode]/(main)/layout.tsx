import { Metadata } from "next"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer, getCustomerWishlistItems } from "@lib/data/customer"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption, StoreRegion } from "@medusajs/types"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"
import { listRegions } from "@lib/data/regions"
import Navbar from "@modules/layout/Navbar"
import Footer from "@modules/layout/Footer"
import Scrollbar from "@modules/layout/scrollbar"
import GlobalLiquidEther from "@modules/layout/components/global-liquid-ether"
import type { NavigationCollection } from "@modules/layout/Navbar/productsButton"
// import { listCollections } from "@lib/data/collections"
// import { listCategories } from "@lib/data/categories"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()
  let shippingOptions: StoreCartShippingOption[] = []
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)

  // Fetch customer wishlist items
  const wishlistItems = await getCustomerWishlistItems()

  // TODO: Re-enable once collections and their products exist in Medusa.
  // const [collectionResult, categories] = await Promise.all([
  //   listCollections({ fields: "*products" }).catch(() => ({ collections: [], count: 0 })),
  //   listCategories({ limit: 100 }).catch(() => []),
  // ])
  //
  // const navigationCollections: NavigationCollection[] = collectionResult.collections.map(
  //   (collection, collectionIndex) => {
  //     const productIds = new Set(collection.products?.map((product) => product.id) ?? [])
  //     const matchingCategories = categories.filter((category) =>
  //       category.products?.some((product) => productIds.has(product.id))
  //     )
  //     const metadata = (collection.metadata ?? {}) as Record<string, unknown>
  //     const metadataImage = typeof metadata.image === "string" ? metadata.image : null
  //     const productImage = collection.products?.find((product) => product.thumbnail)?.thumbnail
  //
  //     return {
  //       id: collection.id,
  //       title: collection.title,
  //       handle: collection.handle ?? null,
  //       image: metadataImage ?? productImage ?? "/assets/img/img/home_image.png",
  //       categories: matchingCategories.map((category) => ({
  //         id: category.id,
  //         name: category.name,
  //         handle: category.handle ?? null,
  //       })),
  //     }
  //   }
  // )
  const navigationCollections: NavigationCollection[] = []

  if (cart) {
    try {
      const { shipping_options } = await listCartOptions()
      shippingOptions = shipping_options
    } catch (e) {
      console.error("Failed to load shipping options for layout:", e)
      shippingOptions = []
    }
  }

  return (
    <>
      <GlobalLiquidEther />
      <Navbar
        cart={cart}
        regions={regions}
        isLoggedIn={!!customer}
        wishlistItems={wishlistItems}
        navigationCollections={navigationCollections}
      />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      <Scrollbar />
      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      {props.children}
      <Footer />
    </>
  )
}
