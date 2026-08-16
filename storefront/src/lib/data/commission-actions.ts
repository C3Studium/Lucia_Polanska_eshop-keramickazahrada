"use server"

import { revalidateTag } from "next/cache"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheTag, getCartId } from "./cookies"
import {
  addCommissionNote,
  listCommissionNotes,
  uploadCommissionMedia,
} from "./made-to-order"
import { madeToOrderMetadata } from "@lib/util/made-to-order"
import type { CommissionNote, CommissionUpload } from "@lib/util/made-to-order"
import { toCzechErrorMessage } from "@lib/util/error-messages"

export type BriefResult = {
  success: boolean
  photos?: string[]
  message?: string
}

/**
 * Saves the customer's brief onto a cart line — the description, and the photos it came with.
 *
 * The text IS the specification: since the product page stopped collecting one, this box (in
 * the cart and again at checkout) is the only place the customer describes the piece, and the
 * payment step refuses a specification-required commission without it.
 *
 * Written to the **line item's** metadata rather than the cart's, because Medusa copies line
 * metadata into the order. By the time the owner reads this the cart is long gone; the brief
 * has to be attached to the thing being made, not to the basket it was bought in.
 */
export async function saveCommissionBrief(
  lineId: string,
  input: {
    note: string
    keepPhotos: string[]
    newPhotos: CommissionUpload[]
  }
): Promise<BriefResult> {
  try {
    const cartId = await getCartId()
    if (!cartId) {
      return { success: false, message: "Košík se nepovedlo najít." }
    }

    let photos = input.keepPhotos

    if (input.newPhotos.length) {
      const uploaded = await uploadCommissionMedia({ cartId }, input.newPhotos)
      if (!uploaded.length) {
        return {
          success: false,
          message: "Fotky se nepovedlo nahrát. Zkuste to prosím znovu.",
        }
      }
      photos = [...photos, ...uploaded.map((file) => file.url)]
    }

    const headers = { ...(await getAuthHeaders()) }

    await sdk.store.cart.updateLineItem(
      cartId,
      lineId,
      {
        metadata: madeToOrderMetadata(input.note, { photos }).made_to_order,
      } as never,
      {},
      headers
    )

    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) revalidateTag(cartCacheTag)

    return { success: true, photos }
  } catch (error: any) {
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}

/**
 * Adds to the diary of a placed order.
 *
 * The brief does not close when the order does: what someone meant often only becomes sayable
 * once they can see the piece starting, so they keep writing and she keeps reading.
 */
export async function addOrderCommissionNote(
  orderId: string,
  input: { note: string; newPhotos: CommissionUpload[] }
): Promise<{ success: boolean; notes?: CommissionNote[]; message?: string }> {
  try {
    let image_urls: string[] = []

    if (input.newPhotos.length) {
      const uploaded = await uploadCommissionMedia({ orderId }, input.newPhotos)
      if (!uploaded.length) {
        return {
          success: false,
          message: "Fotky se nepovedlo nahrát. Zkuste to prosím znovu.",
        }
      }
      image_urls = uploaded.map((file) => file.url)
    }

    if (!input.note.trim() && !image_urls.length) {
      return {
        success: false,
        message: "Napište prosím pár slov, nebo přiložte fotku.",
      }
    }

    const notes = await addCommissionNote(orderId, {
      text: input.note.trim() || undefined,
      image_urls: image_urls.length ? image_urls : undefined,
    })

    if (!notes) {
      return { success: false, message: "Poznámku se nepovedlo uložit." }
    }

    const ordersCacheTag = await getCacheTag("orders")
    if (ordersCacheTag) revalidateTag(ordersCacheTag)

    return { success: true, notes }
  } catch (error: any) {
    return { success: false, message: toCzechErrorMessage(error?.message) }
  }
}

/** Re-reads the diary, for after an edit. */
export async function refreshCommissionNotes(orderId: string) {
  return listCommissionNotes(orderId)
}
