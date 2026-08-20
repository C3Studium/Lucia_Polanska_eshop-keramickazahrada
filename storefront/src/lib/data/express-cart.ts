"use server"

import { sdk } from "@lib/config"
import { isBalikovnaOption } from "@lib/util/balikovna"
import { deliveryAllowedUnder, deliveryRestrictionFor } from "@lib/util/fragile"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import {
  addBundleToCart,
  addToCart,
  mergeCartMetadata,
  retrieveCart,
  setShippingMethod,
  updateCart,
} from "./cart"
import {
  getAuthHeaders,
  getCacheTag,
  getExpressCartId,
  removeExpressCartId,
  setExpressCartId,
} from "./cookies"
import { retrieveCustomer } from "./customer"
import { listCartShippingMethods } from "./fulfillment"
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
      sdk.store.cart.deleteLineItem(cart.id, item.id, {}, headers)
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
      message: error?.message || "Výrobek se nepovedlo připravit.",
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
      message: error?.message || "Sadu se nepovedlo připravit.",
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
      message: error?.message || "Adresu se nepovedlo uložit.",
    }
  }
}

export async function setExpressCartMetadata(
  cartId: string,
  metadata: Record<string, unknown>
) {
  try {
    // MERGE, not replace: cart updates swap `metadata` wholesale, so writing
    // just the pickup point used to erase the consent record (and vice versa).
    // The merge base is a fresh server-side read — never a client's stale copy.
    await mergeCartMetadata(metadata, cartId)
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Výdejní místo se nepovedlo uložit.",
    }
  }
}

export type ExpressPrefillAddress = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
}

/**
 * The saved address the express flow may prefill from — the customer's default
 * shipping address first, otherwise the first one usable in this region.
 * Exposed for the express page so a logged-in customer never retypes what the
 * account already knows; `null` for guests and empty address books.
 */
export async function getExpressPrefillAddress(
  countryCode: string
): Promise<ExpressPrefillAddress | null> {
  const customer = await retrieveCustomer()
  if (!customer) return null

  const region = await getRegion(countryCode)
  const regionCountries = new Set(
    (region?.countries ?? [])
      .map((country: { iso_2?: string | null }) => country.iso_2?.toLowerCase())
      .filter(Boolean)
  )

  const usable = (customer.addresses ?? []).filter(
    (address) =>
      !!address.country_code &&
      regionCountries.has(address.country_code.toLowerCase())
  )
  const address =
    usable.find((entry) => entry.is_default_shipping) ?? usable[0] ?? null

  if (!address) return null

  return {
    firstName: address.first_name || customer.first_name || "",
    lastName: address.last_name || customer.last_name || "",
    email: customer.email || "",
    phone: address.phone || customer.phone || "",
    address: address.address_1 || "",
    postalCode: address.postal_code || "",
    city: address.city || "",
  }
}

/**
 * Whether „Koupit ihned" may show at all: logged in with a saved address.
 * The PDP is statically prebuilt, so its HTML is permanently anonymous — the
 * button asks this at runtime from the browser instead of trusting frozen
 * build-time props. Display-only; startExpressBuyNow re-checks everything
 * server-side before any cart is touched.
 */
export async function getBuyNowEligibility(): Promise<boolean> {
  const customer = await retrieveCustomer()
  return (customer?.addresses?.length ?? 0) > 0
}

type BuyNowStep = "selection" | "delivery" | "payment"

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

/**
 * „Koupit ihned" — PDP straight to the express payment step.
 *
 * For a logged-in customer with a saved address: puts the chosen variant into
 * the express cart, prefills the saved address, and preselects Česká pošta
 * carriage to that address (per the owner: never Balíkovna, never pickup).
 * Every precondition that fails downgrades the landing step instead of dead-
 * ending — worst case the customer starts the ordinary express flow at step 1.
 */
export async function startExpressBuyNow({
  countryCode,
  variantId,
  quantity,
}: {
  countryCode: string
  variantId: string
  quantity: number
}): Promise<{ success: boolean; step: BuyNowStep; message?: string }> {
  const selection = await selectExpressVariant({
    countryCode,
    variantId,
    quantity,
  })

  if (!selection.success || !("cartId" in selection) || !selection.cartId) {
    return {
      success: false,
      step: "selection",
      message:
        ("message" in selection && selection.message) ||
        "Výrobek se nepovedlo připravit.",
    }
  }

  const cartId = selection.cartId
  const prefill = await getExpressPrefillAddress(countryCode)

  // No usable saved address after all — the ordinary flow takes over at delivery.
  if (
    !prefill ||
    !prefill.firstName.trim() ||
    !prefill.lastName.trim() ||
    !prefill.email.trim() ||
    !prefill.address.trim() ||
    !prefill.postalCode.trim() ||
    !prefill.city.trim()
  ) {
    return { success: true, step: "delivery" }
  }

  const addressResult = await setExpressAddress({
    cartId,
    countryCode,
    data: prefill,
  })
  if (!addressResult.success) {
    return { success: true, step: "delivery" }
  }

  /* The express delivery form requires a phone; without one the customer must
     pass through the (prefilled) delivery step to add it. Setting a shipping
     method now would let the stepper's gates skip that. */
  if (!prefill.phone.trim()) {
    return { success: true, step: "delivery" }
  }

  const options = (await listCartShippingMethods(cartId)) ?? []
  const cart = await retrieveCart(cartId)
  /* Fragile / zakázka baskets may only travel as křehký balík or be collected —
     the same rule the classic checkout enforces. Only the ČP options that rule
     permits are candidates here. */
  const restriction = deliveryRestrictionFor(cart as any, false)

  const homeDelivery = options.find((option) => {
    const type = (option as any).service_zone?.fulfillment_set?.type
    if (type === "pickup") return false
    if (isBalikovnaOption(option)) return false
    if (!fold(option.name ?? "").includes("ceska posta")) return false
    if (restriction && !deliveryAllowedUnder(option, false)) return false
    return true
  })

  if (!homeDelivery) {
    return { success: true, step: "delivery" }
  }

  const shippingResult = await setShippingMethod({
    cartId,
    shippingMethodId: homeDelivery.id,
  })

  return { success: true, step: shippingResult.success ? "payment" : "delivery" }
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
      message: result.error?.message || "Objednávku se nepovedlo dokončit.",
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Objednávku se nepovedlo dokončit.",
    }
  }
}
