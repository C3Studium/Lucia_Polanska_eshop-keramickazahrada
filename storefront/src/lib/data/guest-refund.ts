"use server"

import { sdk } from "@lib/config"

/**
 * Předvyplnění stránky reklamace / vrácení / odstoupení z e-mailového odkazu
 * (token). Bez auth hlaviček (jen publishable key), token v query; backend ho
 * ověří. `null` když token neplatí nebo se objednávka nenačte.
 */

export type GuestRefundItem = {
  id: string
  title: string
  quantity: number
  is_made_to_order: boolean
}

export type GuestRefundContext = {
  order_display_id: string
  email: string
  created_at: string
  currency_code: string
  items: GuestRefundItem[]
  /** Když je vše na míru, 14denní odstoupení se nenabízí (§1837). */
  all_made_to_order: boolean
}

export async function getGuestRefundContext(
  orderId: string,
  token: string
): Promise<GuestRefundContext | null> {
  try {
    return await sdk.client.fetch<GuestRefundContext>(
      `/store/orders/${orderId}/guest-refund`,
      { query: { token }, cache: "no-store" }
    )
  } catch {
    return null
  }
}
