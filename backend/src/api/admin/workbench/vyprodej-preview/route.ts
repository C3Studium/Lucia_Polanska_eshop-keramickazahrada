import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { previewVyprodej } from "../../../../lib/vyprodej"

const Schema = z.object({
  type: z.enum(["time", "stock"]),
  collection_ids: z.array(z.string()).max(200).default([]),
  category_ids: z.array(z.string()).max(500).default([]),
  product_ids: z.array(z.string()).max(2000).default([]),
  ignore_id: z.string().optional(),
})

/** Průvodce výprodejem: kolik výrobků by vzal (nic nezapisuje). */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = Schema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.issues[0]?.message ?? "Neplatný výběr.")
  }
  res.status(200).json(await previewVyprodej(req.scope, parsed.data))
}
