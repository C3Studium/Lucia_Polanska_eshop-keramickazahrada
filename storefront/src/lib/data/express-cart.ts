"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import {
  addBundleToCart,
  addToCart,
  retrieveCart,
  updateCart,
} from "./cart"
import {
  getAuthHeaders,
  getCacheTag,
  getExpressCartId,
  removeExpressCartId,
  setExpressCartId,
} from "./cookies"
import { getRegion } from "./regions"

const refreshExpressCart = async () => {
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) revalidateTag(cartCacheTag)

  const fulfillmentCacheTag = await getCacheTag("fulfillment")
  if (fulfillmentCacheTag) revalidateTag(fulfillmentCacheTag)
}

export async function retrieveExpressCart() {
  const cartId = await getExpressCartId()
  return cartId ? retrieveCart(cartId) : null
}

export async function getOrSetExpressCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  const headers = { ...(await getAuthHeaders()) }
  let cart = await retrieveExpressCart()

  if (!cart) {
    const response = await sdk.store.cart.create(
      { region_id: region.id },
      {},
      headers
    )
    cart = response.cart
    await setExpressCartId(cart.id)
    await refreshExpressCart()
  } else if (cart.region_id !== region.id) {
    cart = (
      await sdk.store.cart.update(
        cart.id,
        { region_id: region.id },
        {},
        headers
      )
    ).cart
    await refreshExpressCart()
  }

  return cart
}

async function emptyExpressCart(cart: HttpTypes.StoreCart) {
  const headers = { ...(await getAuthHeaders()) }
  await Promise.all(
    (cart.items || []).map((item) =>
      sdk.store.cart.deleteLineItem(cart.id, item.id, headers)
    )
  )
  await refreshExpressCart()
}

export async function selectExpressVariant({
  countryCode,
  variantId,
  quantity,
}: {
  countryCode: string
  variantId: string
  quantity: number
}) {
  try {
    const cart = await getOrSetExpressCart(countryCode)
    await emptyExpressCart(cart)

    const result = await addToCart({
      variantId,
      quantity,
      countryCode,
      cartId: cart.id,
      metadata: { source: "express-checkout" },
    })

    if (!result.success) return result
    return { success: true, cartId: cart.id }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Produkt se nepodařilo připravit.",
    }
  }
}

export async function selectExpressBundle({
  countryCode,
  bundleId,
  quantity,
  items,
}: {
  countryCode: string
  bundleId: string
  quantity: number
  items: { item_id: string; variant_id: string }[]
}) {
  try {
    const cart = await getOrSetExpressCart(countryCode)
    await emptyExpressCart(cart)
    await addBundleToCart({
      bundleId,
      quantity,
      countryCode,
      items,
      cartId: cart.id,
    })

    return { success: true, cartId: cart.id }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Balíček se nepodařilo připravit.",
    }
  }
}

export async function setExpressAddress({
  cartId,
  countryCode,
  data,
}: {
  cartId: string
  countryCode: string
  data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
    postalCode: string
    city: string
  }
}) {
  try {
    const address = {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      phone: data.phone.trim(),
      address_1: data.address.trim(),
      address_2: "",
      postal_code: data.postalCode.trim(),
      city: data.city.trim(),
      country_code: countryCode.toLowerCase(),
    }

    await updateCart(
      {
        shipping_address: address,
        billing_address: address,
        email: data.email.trim(),
      },
      cartId
    )

    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Adresu se nepodařilo uložit.",
    }
  }
}

export async function setExpressCartMetadata(
  cartId: string,
  metadata: Record<string, unknown>
) {
  try {
    await updateCart({ metadata }, cartId)
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Výdejní místo se nepodařilo uložit.",
    }
  }
}

export async function completeExpressCart(cartId: string) {
  try {
    const headers = { ...(await getAuthHeaders()) }
    const result = await sdk.store.cart.complete(cartId, {}, headers)

    await refreshExpressCart()

    if (result.type === "order") {
      const orderCacheTag = await getCacheTag("orders")
      if (orderCacheTag) revalidateTag(orderCacheTag)
      await removeExpressCartId()
      return { success: true, orderId: result.order.id }
    }

    return {
      success: false,
      message: result.error?.message || "Objednávku se nepodařilo dokončit.",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Objednávku se nepodařilo dokončit.",
    }
  }
}
