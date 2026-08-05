import { sdk } from "@lib/config"

import { getAuthHeaders } from "./cookies"

/**
 * „Kde je moje objednávka?" — the merchant stage and any outstanding balance.
 *
 * Customer-authenticated. The backend answers **404 for an order that is not the caller's**,
 * deliberately, so a stranger cannot learn that an id exists — the UI must not distinguish
 * "not found" from "not yours". Guest orders have no access at all; the e-mail carries a signed
 * link for the one action a guest can take.
 */
export type OrderProgress = {
  stage: string | null
  stage_label: string
  stage_changed_at: string | null
  made_to_order: boolean
  balance: {
    outstanding: number
    currency_code: string
    /** Signed by the backend — never construct one client-side. */
    payment_url: string
  } | null
}

export const getOrderProgress = async (
  orderId: string
): Promise<OrderProgress | null> => {
  const headers = { ...(await getAuthHeaders()) }

  return sdk.client
    .fetch<OrderProgress>(`/store/orders/${orderId}/progress`, {
      headers,
      cache: "no-store",
    })
    .catch(() => null)
}

/**
 * What the customer sees when the merchant workflow has not picked the order up — `stage` is
 * null for orders placed before it existed. Medusa's own status is the fallback.
 */
export const fallbackStageLabel = (order: {
  status?: string | null
  fulfillment_status?: string | null
  payment_status?: string | null
}) => {
  if (order.status === "canceled") return "Zrušeno"

  switch (order.fulfillment_status) {
    case "delivered":
      return "Doručeno"
    case "shipped":
      return "Odesláno"
    case "fulfilled":
      return "Zabaleno"
    default:
      return order.payment_status === "captured" ? "Přijato" : "Přijato"
  }
}
