import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MedusaError } from "@medusajs/framework/utils"
import {
  deleteSeasonalSelectionWorkflow,
  updateSeasonalSelectionWorkflow,
} from "../../../../../workflows/manage-seasonal-selection"
import { PostSeasonalSelectionSchema } from "../route"

export const PatchSeasonalSelectionSchema = PostSeasonalSelectionSchema.partial()

async function retrieve(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "seasonal_selection",
    fields: ["*", "items.*", "items.product.*", "price_list.*"],
    filters: { id: req.params.id },
  })
  if (!data[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seasonal selection was not found.")
  }
  return data[0]
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ seasonal_selection: await retrieve(req) })
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<z.infer<typeof PatchSeasonalSelectionSchema>>,
  res: MedusaResponse
) {
  await updateSeasonalSelectionWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })
  res.json({ seasonal_selection: await retrieve(req) })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteSeasonalSelectionWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ ...result, object: "seasonal_selection" })
}
