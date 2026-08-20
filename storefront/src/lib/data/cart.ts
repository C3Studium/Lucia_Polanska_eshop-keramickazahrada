"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { retrieveCustomer } from "./customer"
import { getRegion } from "./regions"
import { toCzechErrorMessage } from "@lib/util/error-messages"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        /* `items.product.categories.handle`: checkout has to know whether a line is
           zakázková výroba, and the handle is the readable, admin-stable way to ask. The
           relation already comes back — only the ids, which say nothing on their own. */
        fields:
          "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, +items.product.categories.handle",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart()

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id },
      {},
      headers
    )
    cart = cartResp.cart

    await setCartId(cart.id)

  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
  await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(
  data: HttpTypes.StoreUpdateCart,
  explicitCartId?: string
) {
  const cartId = explicitCartId || (await getCartId())

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      if (fulfillmentCacheTag) revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
  metadata = {},
  cartId,
}: {
  variantId: string
  quantity: number
  countryCode: string
  metadata?: Record<string, any>
  cartId?: string
}): Promise<{ success: boolean; message?: string }> {
  try {
    if (!variantId) {
      return { success: false, message: "Missing variant ID when adding to cart" }
    }

    const cart = cartId
      ? await retrieveCart(cartId)
      : await getOrSetCart(countryCode)

    if (!cart) {
      return { success: false, message: "Error retrieving or creating cart" }
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.client.fetch<{
      cart: HttpTypes.StoreCart
    }>(`/store/carts/${cart.id}/line-items-custom`, {
      method: "POST",
      body: {
        variant_id: variantId,
        quantity,
        metadata,
      },
      headers,
    })

    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) revalidateTag(cartCacheTag)

    const fulfillmentCacheTag = await getCacheTag("fulfillment")
    if (fulfillmentCacheTag) revalidateTag(fulfillmentCacheTag)

    return { success: true }
  } catch (e: any) {
    // Normalize Medusa error messages
    const message = toCzechErrorMessage(e?.message)
    return { success: false, message }
  }
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      if (fulfillmentCacheTag) revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}): Promise<{ success: boolean; message?: string }> {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.addShippingMethod(
      cartId,
      { option_id: shippingMethodId },
      {},
      headers
    )

    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) revalidateTag(cartCacheTag)

    return { success: true }
  } catch (e: any) {
    const message = toCzechErrorMessage(e?.message)
    return { success: false, message }
  }
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession
): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }
    const resp = await sdk.store.payment.initiatePaymentSession(
      cart,
      data,
      {},
      headers
    )
    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) revalidateTag(cartCacheTag)
    return { success: true, data: resp }
  } catch (e: any) {
    const message = toCzechErrorMessage(e?.message)
    return { success: false, message }
  }
}

/**
 * Attempts to capture a payment on the backend. Expects a store API route to handle capture.
 * If the route is not available, this will fail gracefully and the caller can fallback to placeOrder.
 */
export async function capturePayment({
  cartId,
  paymentSessionId,
  providerId,
  payload = {},
}: {
  cartId: string
  paymentSessionId?: string
  providerId?: string
  payload?: Record<string, any>
}): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }
    const res = await sdk.client
      .fetch<{
        ok: boolean
        data?: any
        message?: string
      }>(`/store/payment/capture`, {
        method: "POST",
        headers,
        body: {
          cart_id: cartId,
          payment_session_id: paymentSessionId,
          provider_id: providerId,
          payload,
        },
      })

    return { success: !!res.ok, data: res.data, message: res.message }
  } catch (e: any) {
    const message = toCzechErrorMessage(e?.message)
    return { success: false, message }
  }
}

export async function initComgateMetadata({
  cartId,
  email,
  firstName,
  lastName,
}: {
  cartId: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
}): Promise<{ success: boolean; message?: string }> {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }
    await sdk.store.cart.update(
      cartId,
      {
        metadata: {
          comgate_order_ref: cartId,
          comgate_email: email ?? null,
          comgate_first_name: firstName ?? null,
          comgate_last_name: lastName ?? null,
        },
      },
      {},
      headers
    )
    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) revalidateTag(cartCacheTag)
    return { success: true }
  } catch (e: any) {
    return { success: false, message: toCzechErrorMessage(e?.message) }
  }
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async ({ cart }) => {
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      if (fulfillmentCacheTag) revalidateTag(fulfillmentCacheTag)

      // return the updated cart so callers can inspect applied promotions
      return cart
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

/**
 * Merges a metadata patch into the cart WITHOUT trusting the caller's copy.
 *
 * Cart updates replace `metadata` wholesale, and client components hold stale
 * carts — spreading `cart.metadata` from a prop could resurrect an old
 * `production_payment_amount` seconds before the customer is charged by it.
 * So the merge base is always a fresh server-side read.
 */
export async function mergeCartMetadata(
  patch: Record<string, unknown>,
  cartId?: string
) {
  const id = cartId || (await getCartId())
  if (!id) {
    throw new Error("Košík se nepodařilo najít.")
  }
  const fresh = await retrieveCart(id)
  return updateCart(
    { metadata: { ...((fresh?.metadata as Record<string, unknown>) ?? {}), ...patch } },
    id
  )
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  try {
    /*
     * `applyPromotions` REPLACES the cart's promotion list wholesale — sending
     * just the new code silently dropped every code already applied. Union
     * with the fresh server-side list, so a second code adds instead of swaps.
     */
    const currentCart = await retrieveCart()
    const existingCodes = (currentCart?.promotions ?? [])
      .map((promotion: any) => promotion?.code)
      .filter((value: unknown): value is string => typeof value === "string")
    const cart = await applyPromotions(
      Array.from(new Set([...existingCodes, code]))
    )

    // If the backend accepted the update but did not apply a promotion for the
    // provided code, surface a user-friendly message so the UI can show it.
    if (cart) {
      const found = (cart.promotions || []).some((p: any) => p.code === code)
      if (!found) {
        return "Tenhle slevový kód neplatí." // Czech: "Promotion code is not valid."
      }
    }
  } catch (e: any) {
    return e.message
  }
}

/**
 * Fills the cart's addresses from the logged-in customer's saved address —
 * the checkout's address step collapses into a summary instead of opening as
 * a form the account could already answer.
 *
 * Deliberately narrow: only fires when the cart has NO shipping address yet
 * (never overwrites anything the customer typed), only uses an address inside
 * the cart's region, and prefers the default shipping address. Idempotent, so
 * a re-render firing it twice changes nothing.
 */
export async function applySavedAddressToCart(): Promise<{
  success: boolean
  message?: string
}> {
  try {
    const cartId = await getCartId()
    if (!cartId) {
      return { success: false, message: "Košík se nepodařilo najít." }
    }

    const cart = await retrieveCart(cartId)
    if (!cart) {
      return { success: false, message: "Košík se nepodařilo najít." }
    }
    if (cart.shipping_address) {
      // Someone (or a parallel tab) already answered — nothing to do.
      return { success: true }
    }

    const customer = await retrieveCustomer()
    if (!customer) {
      return { success: false, message: "Nejste přihlášeni." }
    }

    const regionCountries = new Set(
      (cart.region?.countries ?? [])
        .map((country) => country.iso_2?.toLowerCase())
        .filter(Boolean)
    )
    const usable = (customer.addresses ?? []).filter(
      (address) =>
        !!address.country_code &&
        regionCountries.has(address.country_code.toLowerCase())
    )
    const saved =
      usable.find((address) => address.is_default_shipping) ?? usable[0]

    if (
      !saved ||
      !saved.first_name ||
      !saved.last_name ||
      !saved.address_1 ||
      !saved.postal_code ||
      !saved.city
    ) {
      return { success: false, message: "Uložená adresa není kompletní." }
    }

    const email = cart.email || customer.email
    if (!email) {
      return { success: false, message: "Chybí e-mail." }
    }

    const address = {
      first_name: saved.first_name,
      last_name: saved.last_name,
      address_1: saved.address_1,
      address_2: saved.address_2 || "",
      company: saved.company || "",
      postal_code: saved.postal_code,
      city: saved.city,
      country_code: saved.country_code!,
      province: saved.province || "",
      phone: saved.phone || customer.phone || "",
    }

    await updateCart(
      { shipping_address: address, billing_address: address, email },
      cartId
    )

    return { success: true }
  } catch (e: any) {
    return { success: false, message: toCzechErrorMessage(e?.message) }
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    if (!formData) {
      throw new Error("No form data found when setting addresses")
    }
    // Unawaited, this was a Promise — always truthy, so the guard never fired and a missing
    // cart surfaced later as an opaque failure instead of this sentence.
    const cartId = await getCartId()
    if (!cartId) {
      throw new Error("No existing cart found when setting addresses")
    }

    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      email: formData.get("email"),
    } as any

    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address

    if (sameAsBilling !== "on")
      data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
      }
    await updateCart(data)
  } catch (e: any) {
    return e.message
  }

  redirect(
    `/${formData.get("shipping_address.country_code")}/checkout?step=delivery`
  )
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */

// ...existing code...
export async function createOrderFromCart(cartId: string) {
  if (!cartId) {
    throw new Error("Missing cartId when creating order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const res = await sdk.client.fetch<{ order?: HttpTypes.StoreOrder }>(`/store/orders`, {
      method: "POST",
      headers,
      body: { cart_id: cartId },
    })

    // pokud API vrátí order, vrať ho
    if (res && (res as any).order) {
      const order = (res as any).order as HttpTypes.StoreOrder
      const orderCacheTag = await getCacheTag("orders")
      if (orderCacheTag) revalidateTag(orderCacheTag)
      // odstraníme cartId cookie, protože cart byl proměněn v order
      await removeCartId()
      return order
    }

    return null
  } catch (e: any) {
    // nepřepisujeme původní placeOrder chování, necháme chybu zpracovat volající
    throw e
  }
}
// ...existing code...

export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    if (orderCacheTag) revalidateTag(orderCacheTag)

    /*
     * Clear the cart cookie only when the cart just completed IS the one the
     * cookie points to. Express checkout completes its own separate cart —
     * unconditionally deleting here threw away the customer's main basket as
     * a side effect of an express purchase.
     */
    const cookieCartId = await getCartId()
    if (!cookieCartId || cookieCartId === id) {
      // Awaited — `redirect()` throws on the next line, and an un-awaited
      // cookie write may never make it into the response.
      await removeCartId()
    }
    redirect(`/${countryCode}/order/${cartRes?.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    /*
     * A cart cannot always follow the shop across a currency — an item with no price in the
     * new region makes Medusa refuse the update, and `updateCart` rethrows. That used to take
     * the redirect below down with it: the customer picked a country, nothing happened, and
     * because the caller fired this off unawaited there was not even an error to see. A cart
     * that will not move is a reason to leave the cart where it is, not to refuse the country.
     * `getOrSetCart` re-points it on the next add anyway.
     */
    try {
      await updateCart({ region_id: region.id })
      const cartCacheTag = await getCacheTag("carts")
      if (cartCacheTag) revalidateTag(cartCacheTag)
    } catch {
      // Deliberately swallowed: the country change below must still happen.
    }
  }

  const regionCacheTag = await getCacheTag("regions")
  if (regionCacheTag) revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  if (productsCacheTag) revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}

export async function addBundleToCart({
  bundleId,
  quantity,
  countryCode,
  items,
  cartId,
}: {
  bundleId: string
  quantity: number
  countryCode: string
  items: {
    item_id: string
    variant_id: string
  }[]
  cartId?: string
}) {
  if (!bundleId) {
    throw new Error("Missing bundle ID when adding to cart")
  }

  const cart = cartId
    ? await retrieveCart(cartId)
    : await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.client.fetch<HttpTypes.StoreCartResponse>(
    `/store/carts/${cart.id}/line-item-bundles`,
  {
    method: "POST",
    body: {
      bundle_id: bundleId,
      quantity,
      items,
    },
    headers,
  })
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function removeBundleFromCart(bundleId: string) {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
 
  await sdk.client.fetch<HttpTypes.StoreCartResponse>(
    `/store/carts/${cartId}/line-item-bundles/${bundleId}`, 
    {
      method: "DELETE",
      headers,
    }
  )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}
