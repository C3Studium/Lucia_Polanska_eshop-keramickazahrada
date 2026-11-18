import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  getProductSale,
  removeProductSale,
  setProductSale,
  setProductSaleEnabled,
} from "../../../../../../lib/product-sale"

/**
 * Sleva u výrobku — detail produktu, sekce Cena (18. 11. 2026).
 * Jádro a důvody viz `lib/product-sale.ts`.
 *
 * - GET    → `{ sale }` (nebo `null`)
 * - POST   → `{ percent, starts_at, ends_at, enabled }` založí/přepíše slevu;
 *            samotné `{ enabled }` ji jen zapne/vypne
 * - DELETE → slevu odebere
 */

const datum = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Neplatné datum.")
  .nullable()
  .optional()

export const PostProductSaleSchema = z
  .object({
    /** 1–90 %. Víc je skoro vždy překlep za pevnou cenu. */
    percent: z.number().int().min(1).max(90).optional(),
    starts_at: datum,
    ends_at: datum,
    enabled: z.boolean().optional(),
  })
  .refine(
    (body) =>
      !body.starts_at ||
      !body.ends_at ||
      new Date(body.starts_at).getTime() < new Date(body.ends_at).getTime(),
    { message: "Konec slevy musí být po jejím začátku.", path: ["ends_at"] }
  )

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sale = await getProductSale(req.scope, req.params.productId)
  res.status(200).json({ sale })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostProductSaleSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Neplatné údaje slevy."
    )
  }
  const body = parsed.data

  if (body.percent === undefined) {
    if (body.enabled === undefined) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Chybí výše slevy.")
    }
    const sale = await setProductSaleEnabled(req.scope, req.params.productId, body.enabled)
    res.status(200).json({ sale })
    return
  }

  const sale = await setProductSale(req.scope, req.params.productId, {
    percent: body.percent,
    starts_at: body.starts_at ?? null,
    ends_at: body.ends_at ?? null,
    enabled: body.enabled ?? true,
  })
  res.status(200).json({ sale })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const removed = await removeProductSale(req.scope, req.params.productId)
  res.status(200).json({ removed })
}
