import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * One diary entry: show it to the customer or take it back (PATCH), or
 * remove it entirely (DELETE — a blurry photo is a fact of phone cameras).
 */

const PatchNoteSchema = z.object({
  visible_to_customer: z.boolean(),
})

export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PatchNoteSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Chybí, zda má být zápis vidět."
    )
  }

  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const note = await service.updateProductionNotes({
    id: req.params.noteId,
    visible_to_customer: parsed.data.visible_to_customer,
  } as never)

  res.status(200).json({ note })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  await service.deleteProductionNotes(req.params.noteId)
  res.status(200).json({ id: req.params.noteId, deleted: true })
}
