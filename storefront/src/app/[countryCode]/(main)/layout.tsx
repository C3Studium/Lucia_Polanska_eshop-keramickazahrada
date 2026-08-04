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
import { listNavigationCollections } from "@lib/data/navigation"

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

  const navigationCollections = await listNavigationCollections()

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
