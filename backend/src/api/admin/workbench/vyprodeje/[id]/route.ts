import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { deleteVyprodej, updateVyprodej } from "../../../../../lib/vyprodej"
import { datesOk, VyprodejBody } from "../schema"

const PatchBody = VyprodejBody.partial().extend({
  enabled: z.boolean().optional(),
  add_product_ids: z.array(z.string()).max(200).optional(),
  remove_product_ids: z.array(z.string()).max(200).optional(),
})

/** Úprava výprodeje (i přidání/vyřazení jednoho výrobku z jeho detailu). */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PatchBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.issues[0]?.message ?? "Neplatná úprava.")
  }
  if (!datesOk(parsed.data)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Konec výprodeje musí být po jeho začátku.")
  }
  /* `partial()` nechá výchozí hodnoty polí — u úpravy znamenají „beze změny". */
  const raw = (req.body ?? {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(parsed.data)) {
    if (key in raw) patch[key] = (parsed.data as any)[key]
  }
  const vyprodej = await updateVyprodej(req.scope, req.params.id, patch as any)
  res.status(200).json({ vyprodej })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const removed = await deleteVyprodej(req.scope, req.params.id)
  res.status(200).json({ removed })
}
