import { sdk } from "@lib/config"

import { getCacheOptions } from "./cookies"
import type {
  ProductionPaymentMode,
  ProductionProfile,
} from "@lib/util/made-to-order"

/**
 * Server-side fetchers for the backend's made-to-order routes. Types and pure helpers live in
 * `@lib/util/made-to-order` so client components can use them without pulling `server-only`.
 */

export type { ProductionPaymentMode, ProductionProfile }

/** `{ production_profile: null }` for an ordinary product — the caller renders nothing. */
export const getProductionProfile = async (
  productId: string
): Promise<ProductionProfile | null> => {
  const next = { ...(await getCacheOptions("products")) }

  return sdk.client
    .fetch<{ production_profile: ProductionProfile | null }>(
      `/store/products/${productId}/production-profile`,
      { next, cache: "force-cache" }
    )
    .then(({ production_profile }) => production_profile ?? null)
    .catch(() => null)
}

export const getProductionPaymentMode = async (
  cartId: string
): Promise<ProductionPaymentMode | null> =>
  sdk.client
    .fetch<ProductionPaymentMode>(
      `/store/carts/${cartId}/production-payment-mode`,
      { cache: "no-store" }
    )
    .catch(() => null)

export const setProductionPaymentMode = async (
  cartId: string,
  mode: "deposit" | "full"
): Promise<ProductionPaymentMode | null> =>
  sdk.client
    .fetch<ProductionPaymentMode>(
      `/store/carts/${cartId}/production-payment-mode`,
      { method: "POST", body: { mode }, cache: "no-store" }
    )
    .catch(() => null)
