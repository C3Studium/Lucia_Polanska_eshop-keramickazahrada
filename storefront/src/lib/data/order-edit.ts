"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"

/**
 * Zákaznická editace objednávky — tenká vrstva nad
 * /store/orders/:id/edit. Pravidla soudí server; tady se jen ptáme a
 * posíláme. Viz backend `order-edit-rules` pro tři zákony (zakázky ne,
 * prázdno ne, peníze podle matice).
 */

export type EditVariant = { id: string; title: string | null; price_czk: number | null }
export type EditableItem = {
  id: string
  title: string
  quantity: number
  variant_id: string | null
  unit_price: number
  is_made_to_order: boolean
  variants: EditVariant[]
}
export type OrderEditContext = {
  editable: boolean
  reason: string | null
  payment: "card" | "pickup" | "dobirka"
  currency_code: string
  items: EditableItem[]
  pending_change: { id: string; awaiting_payment: boolean } | null
}
export type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }
  | { type: "remove"; item_id: string }
  | { type: "add"; variant_id: string; quantity: number }

export type EditResult =
  | { status: "awaiting_payment"; difference: number; payment_url: string; message: string }
  | { status: "confirmed"; difference: number; refund_due: number; message: string }

export async function getOrderEditContext(orderId: string): Promise<OrderEditContext | null> {
  try {
    return await sdk.client.fetch<OrderEditContext>(`/store/orders/${orderId}/edit`, {
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
  } catch {
    return null
  }
}

export async function submitOrderEdit(
  orderId: string,
  actions: EditAction[]
): Promise<EditResult | { error: string }> {
  try {
    return await sdk.client.fetch<EditResult>(`/store/orders/${orderId}/edit`, {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { actions },
    })
  } catch (error: any) {
    return { error: error?.message ?? "Úpravu se nepodařilo uložit." }
  }
}

export async function cancelOrderEdit(orderId: string): Promise<void> {
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/edit`, {
      method: "DELETE",
      headers: { ...(await getAuthHeaders()) },
    })
  } catch {
    // rušení je best-effort
  }
}
