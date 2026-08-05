"use server"

import { setProductionPaymentMode } from "./made-to-order"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"

/** Server action: persist the customer's deposit/full choice and return the backend's figures. */
export async function selectProductionPaymentMode(
  cartId: string,
  mode: "deposit" | "full"
): Promise<ProductionPaymentMode | null> {
  return setProductionPaymentMode(cartId, mode)
}
