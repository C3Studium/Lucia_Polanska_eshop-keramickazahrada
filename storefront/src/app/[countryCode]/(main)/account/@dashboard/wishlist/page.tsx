import { Metadata } from "next"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { retrieveCustomer, refreshAuthToken } from "@lib/data/customer"
import { retrieveProduct } from "@lib/data/products"
import WishlistTemplate from "@modules/account/templates/wishlist-template"
import { listRegions } from "@lib/data/regions"
import { sdk } from "@lib/config"
import { accountPreviewWishlistItems } from "@modules/account/preview-data"

import s from "../styles/profile.module.scss"

export const metadata: Metadata = {
  title: "Oblíbené objekty",
  description: "Objekty uložené na později.",
}

async function getCustomerWishlists(_customerId: string) {
  const cookieStore = await cookies()
  let token = cookieStore.get("_medusa_jwt")?.value
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  console.log("[Wishlist Page] Getting wishlist items...")

  if (!token) {
    console.log("[Wishlist Page] No token found")
    return []
  }

  const fetchWishlist = async (currentToken: string) => {
    return await sdk.client.fetch<{ wishlist: { items: any[] } }>(
      `/store/customers/me/wishlists`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${currentToken}`,
          ...(pk ? { "x-publishable-api-key": pk } : {}),
        },
        cache: "no-store",
      }
    )
  }

  try {
    const data = await fetchWishlist(token)
    console.log(
      "[Wishlist Page] Success, items count:",
      data.wishlist?.items?.length || 0
    )
    return data.wishlist?.items ?? []
  } catch (e: any) {
    console.error("[Wishlist Page] Error:", e?.message || e)

    // Check for 401 and retry logic
    const is401 =
      e?.status === 401 ||
      e?.message?.includes("401") ||
      e?.message?.includes("Unauthorized")

    if (is401) {
      console.log("[Wishlist Page] 401 received, attempting token refresh...")
      const newToken = await refreshAuthToken()

      if (newToken) {
        console.log("[Wishlist Page] Token refreshed, retrying request...")
        try {
          const data = await fetchWishlist(newToken)
          console.log("[Wishlist Page] Retry success!")
          return data.wishlist?.items ?? []
        } catch (retryError) {
          console.error("[Wishlist Page] Retry failed:", retryError)
          return []
        }
      } else {
        console.warn("[Wishlist Page] Token refresh failed")
      }
    }

    return []
  }
}

type PageProps = { params: Promise<{ countryCode: string }> }

export default async function WishlistPage(props: PageProps) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  if (!customer || !regions) {
    notFound()
  }

  const wishlistItems = await getCustomerWishlists(customer.id)
  const enrichedItems = await Promise.all(
    wishlistItems.map(async (item: any) => {
      const variant = item?.product_variant
      const product = variant?.product
      const hasHandle = !!product?.handle
      const hasThumb = !!product?.thumbnail
      if (hasHandle && hasThumb) return item

      const productId = product?.id || variant?.product_id
      if (!productId) return item

      try {
        const p = await retrieveProduct(productId, {
          fields: "id,handle,thumbnail,title",
        })
        return {
          ...item,
          product_variant: {
            ...variant,
            product: { ...product, ...p },
          },
        }
      } catch {
        return item
      }
    })
  )
  console.log("Fetched wishlist items", wishlistItems)

  const isPreview =
    process.env.NODE_ENV === "development" && enrichedItems.length === 0
  const visibleItems = isPreview ? accountPreviewWishlistItems : enrichedItems

  return (
    <main className={s.root}>
      <WishlistTemplate
        items={visibleItems}
        countryCode={countryCode}
        isPreview={isPreview}
      />
    </main>
  )
}
