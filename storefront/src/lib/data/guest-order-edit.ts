"use server"

import { sdk } from "@lib/config"
import type {
  EditAction,
  EditResult,
  OrderEditContext,
} from "./order-edit"

/**
 * Hostovská editace objednávky z e-mailového odkazu — dvojče
 * `order-edit.ts`, ale autorizace není přihlášení, nýbrž **podepsaný token**
 * z odkazu (`?token=`). Posílá se tedy BEZ auth hlaviček (jen publishable key
 * přes SDK) a token jde v query/body; backend ho ověří (`verifyOrderAccessToken`)
 * a pravidla soudí stejně jako u zákaznické editace. Viz
 * `/store/orders/:id/guest-edit` a `lib/order-access-link.ts`.
 */

export async function getGuestOrderEditContext(
  orderId: string,
  token: string
): Promise<OrderEditContext | null> {
  try {
    return await sdk.client.fetch<OrderEditContext>(
      `/store/orders/${orderId}/guest-edit`,
      { query: { token }, cache: "no-store" }
    )
  } catch {
    return null
  }
}

export async function submitGuestOrderEdit(
  orderId: string,
  actions: EditAction[],
  token: string
): Promise<EditResult | { error: string }> {
  try {
    return await sdk.client.fetch<EditResult>(
      `/store/orders/${orderId}/guest-edit`,
      { method: "POST", body: { actions, token } }
    )
  } catch (error: any) {
    return { error: error?.message ?? "Úpravu se nepodařilo uložit." }
  }
}

export async function cancelGuestOrderEdit(
  orderId: string,
  token: string
): Promise<void> {
  try {
    await sdk.client.fetch(`/store/orders/${orderId}/guest-edit`, {
      method: "DELETE",
      query: { token },
    })
  } catch {
    // rušení je best-effort
  }
}
