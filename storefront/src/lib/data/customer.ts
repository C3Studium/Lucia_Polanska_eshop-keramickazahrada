"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { toCzechErrorMessage } from "@lib/util/error-messages"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"
import { v4 as uuidv4 } from "uuid"

const getSafeAuthRedirect = (formData: FormData): string | null => {
  const redirectTo = formData.get("redirect_to")

  if (
    typeof redirectTo === "string" &&
    /^\/[a-z]{2}\/cart(?:[/?#].*)?$/i.test(redirectTo)
  ) {
    return redirectTo
  }

  return null
}

/**
 * Attempts to refresh the auth token using Medusa SDK.
 * Returns the new token if successful, null otherwise.
 * Note: Does NOT remove the token on failure - the original token might still be valid.
 */
export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const newToken = await sdk.auth.refresh()
    if (newToken && typeof newToken === "string") {
      await setAuthToken(newToken)
      console.log("[Auth] Token refreshed successfully")
      return newToken
    }
    return null
  } catch (error) {
    // Refresh failed - but don't remove the token, it might still be valid
    // The token will naturally expire or be invalidated by the backend
    console.warn("[Auth] Token refresh failed, keeping existing token")
    return null
  }
}

export const retrieveCustomer = async (opts?: {
  forceFresh?: boolean
  _isRetry?: boolean
}): Promise<HttpTypes.StoreCustomer | null> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders || !("authorization" in authHeaders)) return null

  const headers = {
    ...authHeaders,
  }

  const fetchCustomer = async () => {
    // If caller requests fresh data, bypass Next cache
    if (opts?.forceFresh) {
      return await sdk.client
        .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
          method: "GET",
          query: {
            fields: "*orders",
          },
          headers,
          cache: "no-store",
        })
        .then(({ customer }) => customer)
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
  }

  try {
    return await fetchCustomer()
  } catch (error: any) {
    // Check if it's a 401 error and we haven't already retried
    const is401 =
      error?.response?.status === 401 || error?.message?.includes("401")

    if (is401 && !opts?._isRetry) {
      // Try to refresh the token
      const newToken = await refreshAuthToken()
      if (newToken) {
        // Retry with the new token
        return retrieveCustomer({ ...opts, _isRetry: true })
      }
    }

    return null
  }
}

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const email = formData.get("email") as string
  const redirectTo = getSafeAuthRedirect(formData)
  let createdCustomer: HttpTypes.StoreCustomer | undefined
  const customerForm = {
    email,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  // Generate verification token and expiry
  const token = uuidv4()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()

  try {
    // 1. Check if customer exists
    let existingCustomer = await getCustomerByEmail(email)
    if (existingCustomer) {
      const accountCustomer = existingCustomer as typeof existingCustomer & {
        has_account?: boolean
      }

      if (accountCustomer.has_account === false) {
        // Delete guest and create new account
        const deleteRes = await deleteCustomer({
          email,
          password,
          first_name: customerForm.first_name,
          last_name: customerForm.last_name,
          phone: customerForm.phone,
        })
        if (!deleteRes.success) {
          return "Účet se nepodařilo připravit k registraci. Zkuste to prosím znovu."
        }
        // Proceed with standard signup
      } else if (
        accountCustomer.has_account === true &&
        existingCustomer.deleted_at
      ) {
        // Restore deleted customer, but do NOT log in
        const restoreRes = await restoreCustomer(existingCustomer.id)
        if (!restoreRes || restoreRes.success === false) {
          return toCzechErrorMessage(restoreRes?.message)
        }
        return "Váš účet jsme obnovili. Pokud si nepamatujete heslo, nechte si ho prosím zaslat znovu."
      } else {
        return "Účet s tímto e-mailem už existuje. Zkuste se prosím přihlásit."
      }
    }

    // 2. Standard Medusa registration flow
    const registerToken = await sdk.auth.register("customer", "emailpass", {
      email,
      password,
    })

    await setAuthToken(registerToken as string)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer } = await sdk.store.customer.create(
      {
        ...customerForm,
        metadata: {
          email_verified: false,
          email_verification_token: token,
          email_verification_expires_at: expiresAt,
        },
      },
      {},
      headers
    )
    createdCustomer = customer

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart()
  } catch (error: any) {
    return error.toString()
  }

  if (redirectTo) {
    redirect(redirectTo)
  }

  return createdCustomer
}
export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = getSafeAuthRedirect(formData)

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        revalidateTag(customerCacheTag)
      })
  } catch (error: any) {
    // Try to extract a message from the error object
    if (error?.response) {
      try {
        const data = await error.response.json()
        return toCzechErrorMessage(data?.message)
      } catch {
        return toCzechErrorMessage(error.response.statusText)
      }
    }
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  try {
    await transferCart()
  } catch (error: any) {
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  if (redirectTo) {
    redirect(redirectTo)
  }
}
export async function signout(countryCode: string) {
  try {
    await sdk.auth.logout()
  } catch {
    // Always clear the local session, even if the deleted/expired remote
    // identity can no longer accept a logout request.
  }

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

// FIXING THE ISSUE WITH THE ACC REGISTRATION - issue with email already registered inside db but acc not created
export async function getCustomerByEmail(
  email: string
): Promise<HttpTypes.StoreCustomer | null> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return await sdk.client
    .fetch<{ customer: HttpTypes.StoreCustomer }>(
      `store/customers/by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers,
        next: {
          tags: ["customers"],
        },
        cache: "force-cache",
      }
    )
    .then(({ customer }) => customer)
    .catch(() => null)
}

export async function resendVerification(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders()

    // Use sdk.client.fetch for internal Medusa API call
    const res = await sdk.client.fetch<{ message: string }>(
      "store/customers/resend-verification-email",
      {
        method: "POST",
        headers,
        body: { email },
      }
    )

    return { success: true, message: res.message }
  } catch (e: any) {
    // If sdk.client.fetch throws, try to extract the error message
    return { success: false, message: toCzechErrorMessage(e?.message) }
  }
}

// NEED a new call and method to delete guest to registered account properly
export async function deleteCustomer({
  email,
  password,
  first_name,
  last_name,
  phone,
  metadata = {},
}: {
  email: string
  password: string
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Record<string, any>
}): Promise<{ success: boolean; message: string }> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  console.log("Headers:", headers)

  try {
    const response = await sdk.client.fetch<{
      message: string
      customer?: any
    }>("store/customers/upgrade-guest", {
      method: "POST",
      headers,
      body: {
        email,
        password,
        first_name,
        last_name,
        phone,
        metadata,
      },
    })

    return { success: true, message: response.message }
  } catch (error: any) {
    return {
      success: false,
      message: toCzechErrorMessage(error?.message),
    }
  }
}

export async function verifyCustomerEmail(token: string, email: string) {
  const headers = {
    ...(await getAuthHeaders()),
  }
  try {
    const res = await sdk.client.fetch<{ ok: boolean; message?: string }>(
      "store/customers/verify-email",
      {
        method: "POST",
        headers,
        body: { token, email },
      }
    )
    // Ensure 'ok' is always present for frontend logic
    const result = { ok: res.ok ?? true, message: res.message }

    // If verification succeeded, revalidate customer cache so updated metadata is visible
    if (result.ok) {
      try {
        const cacheTag = await getCacheTag("customers")
        revalidateTag(cacheTag)
      } catch (e) {
        // non-fatal: log and continue
        // eslint-disable-next-line no-console
        console.warn(
          "verifyCustomerEmail: failed to revalidate customer cache",
          e
        )
      }
    }

    return result
  } catch (e: any) {
    return { ok: false, message: toCzechErrorMessage(e?.message) }
  }
}

export async function restoreCustomer(customerId: string) {
  try {
    const res = await fetch("/api/store/customers/restore-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    })
    const data = await res.json()
    return data
  } catch (e: any) {
    return {
      success: false,
      message: toCzechErrorMessage(e?.message),
    }
  }
}

export async function deleteAccount(): Promise<{
  success: boolean
  message: string
}> {
  try {
    const headers = await getAuthHeaders()
    if (!headers || !("authorization" in headers)) {
      return { success: false, message: "Unauthorized." }
    }

    await sdk.client.fetch<{ success: boolean; message: string }>(
      "/store/customers/delete-account",
      {
        method: "POST",
        headers,
        cache: "no-store",
      }
    )

    return { success: true, message: "Your account has been deleted." }
  } catch (e: any) {
    return {
      success: false,
      message: toCzechErrorMessage(e?.message),
    }
  }
}

export const getCustomerWishlistItems = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) return []

  const headers = {
    ...authHeaders,
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/customers/me/wishlists`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )

    if (!res.ok) {
      return []
    }

    const data = await res.json()
    return data.wishlist?.items ?? []
  } catch (error) {
    console.error("Failed to fetch wishlist items:", error)
    return []
  }
}
