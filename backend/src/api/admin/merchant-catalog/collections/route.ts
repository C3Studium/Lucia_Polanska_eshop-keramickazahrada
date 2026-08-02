import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createMerchantCollectionWorkflow } from "../../../../workflows/manage-merchant-collection"
import { retrieveMerchantCollections } from "../utils"

export const MerchantCollectionProfileSchema = z.object({
  description: z.string().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  mobile_image_url: z.string().url().nullable().optional(),
  storefront_visible: z.boolean().optional(),
  display_order: z.number().int().nonnegative().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
})

export const MerchantCollectionCategorySchema = z.object({
  category_id: z.string().min(1),
  display_order: z.number().int().nonnegative().optional(),
})

export const PostMerchantCollectionSchema = z.object({
  title: z.string().min(1),
  handle: z.string().min(1).optional(),
  product_ids: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  profile: MerchantCollectionProfileSchema.optional(),
  category_ids: z.array(z.string()).optional(),
  categories: z.array(MerchantCollectionCategorySchema).optional(),
})

export const GetMerchantCollectionsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  q: z.string().optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = (req as any).validatedQuery ?? req.query
  res.json(await retrieveMerchantCollections(req.scope, query))
}

export async function POST(
  req: AuthenticatedMedusaRequest<z.infer<typeof PostMerchantCollectionSchema>>,
  res: MedusaResponse
) {
  const body = req.validatedBody
  const categories = body.categories ?? body.category_ids?.map((category_id, index) => ({
    category_id,
    display_order: index,
  }))
  const { result } = await createMerchantCollectionWorkflow(req.scope).run({
    input: {
      title: body.title,
      handle: body.handle,
      product_ids: body.product_ids,
      metadata: body.metadata,
      profile: body.profile,
      categories,
    },
  })
  const response = await retrieveMerchantCollections(req.scope, { id: result.id })
  res.status(201).json({ collection: response.collections[0] })
}
