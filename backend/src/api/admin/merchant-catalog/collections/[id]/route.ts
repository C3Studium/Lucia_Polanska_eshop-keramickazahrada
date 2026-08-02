import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MedusaError } from "@medusajs/framework/utils"
import {
  deleteMerchantCollectionWorkflow,
  updateMerchantCollectionWorkflow,
} from "../../../../../workflows/manage-merchant-collection"
import {
  MerchantCollectionCategorySchema,
  MerchantCollectionProfileSchema,
} from "../route"
import { retrieveMerchantCollections } from "../../utils"

export const PatchMerchantCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  product_ids: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  profile: MerchantCollectionProfileSchema.optional(),
  category_ids: z.array(z.string()).optional(),
  categories: z.array(MerchantCollectionCategorySchema).optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const response = await retrieveMerchantCollections(req.scope, { id: req.params.id })
  if (!response.collections[0]) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Collection was not found.")
  }
  res.json({ collection: response.collections[0] })
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<z.infer<typeof PatchMerchantCollectionSchema>>,
  res: MedusaResponse
) {
  const body = req.validatedBody
  const categories = body.categories ?? body.category_ids?.map((category_id, index) => ({
    category_id,
    display_order: index,
  }))
  await updateMerchantCollectionWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      title: body.title,
      handle: body.handle,
      product_ids: body.product_ids,
      metadata: body.metadata,
      profile: body.profile,
      categories,
    },
  })
  const response = await retrieveMerchantCollections(req.scope, { id: req.params.id })
  res.json({ collection: response.collections[0] })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteMerchantCollectionWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ ...result, object: "merchant_collection" })
}
