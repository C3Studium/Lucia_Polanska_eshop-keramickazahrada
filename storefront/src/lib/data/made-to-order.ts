import { sdk } from "@lib/config"

import { getCacheOptions } from "./cookies"
import type {
  CommissionNote,
  ProductionPaymentMode,
  ProductionPaymentModeKind,
  ProductionProfile,
} from "@lib/util/made-to-order"

/**
 * Server-side fetchers for the backend's made-to-order routes. Types and pure helpers live in
 * `@lib/util/made-to-order` so client components can use them without pulling `server-only`.
 */

export type { CommissionNote, ProductionPaymentMode, ProductionProfile }

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
  mode: ProductionPaymentModeKind,
  /** Required for `custom`: the charge-now total the slider is sitting on. */
  amount?: number
): Promise<ProductionPaymentMode | null> =>
  sdk.client
    .fetch<ProductionPaymentMode>(
      `/store/carts/${cartId}/production-payment-mode`,
      {
        method: "POST",
        body: mode === "custom" ? { mode, amount } : { mode },
        cache: "no-store",
      }
    )
    .catch(() => null)

/* ---------------------------------------------------------------------------
 * The brief: what the customer writes and photographs about a commission.
 * ------------------------------------------------------------------------ */

type UploadedFile = { id?: string; url: string }

/**
 * Uploads photos and hands back their URLs.
 *
 * Scoped by cart or order id — the route refuses without one — so this is not an open
 * uploader. Sent as base64 because the store namespace has no multipart middleware and a
 * handful of phone photos does not justify adding one in front of every store route.
 */
export const uploadCommissionMedia = async (
  scope: { cartId?: string; orderId?: string },
  files: { filename: string; mime_type: string; data: string }[]
): Promise<UploadedFile[]> =>
  sdk.client
    .fetch<{ files: UploadedFile[] }>(`/store/made-to-order/media`, {
      method: "POST",
      body: {
        ...(scope.cartId ? { cart_id: scope.cartId } : {}),
        ...(scope.orderId ? { order_id: scope.orderId } : {}),
        files,
      },
      cache: "no-store",
    })
    .then(({ files: uploaded }) => uploaded ?? [])
    .catch(() => [])

/**
 * The diary as the customer may see it: their own entries, plus what she opened up.
 *
 * `null` and `[]` mean different things and the caller depends on it: the route 404s for an
 * order that is not a commission, which becomes `null` — draw nothing. An empty array is a
 * zakázka nobody has written on yet, which still deserves somewhere to write.
 */
export const listCommissionNotes = async (
  orderId: string
): Promise<CommissionNote[] | null> =>
  sdk.client
    .fetch<{ notes: CommissionNote[] }>(
      `/store/made-to-order/${orderId}/notes`,
      { cache: "no-store" }
    )
    .then(({ notes }) => notes ?? [])
    .catch(() => null)

/** Adds to the diary after the order exists — the brief keeps growing as the piece does. */
export const addCommissionNote = async (
  orderId: string,
  entry: { text?: string; image_urls?: string[] }
): Promise<CommissionNote[] | null> =>
  sdk.client
    .fetch<{ notes: CommissionNote[] }>(
      `/store/made-to-order/${orderId}/notes`,
      { method: "POST", body: entry, cache: "no-store" }
    )
    .then(({ notes }) => notes ?? [])
    .catch(() => null)
