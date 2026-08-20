"use server"

import { revalidateTag } from "next/cache"
import { getCacheTag } from "./cookies"
import { setProductionPaymentMode } from "./made-to-order"
import type {
  ProductionPaymentMode,
  ProductionPaymentModeKind,
} from "@lib/util/made-to-order"

/**
 * Server action: persist how much of a commission the customer wants to pay now, and hand
 * back the backend's figures.
 *
 * `amount` only matters for `custom`. It is sent as chosen and *not* pre-clamped here — the
 * route rejects anything outside the owner's floor and the basket's ceiling, and a storefront
 * that quietly corrected the number would be charging something the customer did not pick.
 */
export async function selectProductionPaymentMode(
  cartId: string,
  mode: ProductionPaymentModeKind,
  amount?: number
): Promise<ProductionPaymentMode | null> {
  const result = await setProductionPaymentMode(cartId, mode, amount)
  // Without this the review step keeps rendering a STALE cart — and anything
  // that later merges metadata would base itself on the old amount.
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) revalidateTag(cartCacheTag)
  return result
}
