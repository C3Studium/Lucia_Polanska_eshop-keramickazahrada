import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getCustomPriceWorkflow } from "../../../../../workflows/get-custom-price"
import { z } from "@medusajs/framework/zod"

/*
 * Bounds are load-bearing, not cosmetic: the price is derived from these
 * numbers, so a negative height was literally a customer-chosen discount.
 * 3 m is beyond anything the kiln fits — a generous physical ceiling.
 */
export const PostCustomPriceSchema = z.object({
  region_id: z.string(),
  metadata: z.object({
    height: z.number().positive().max(300),
    width: z.number().positive().max(300),
  }),
})

type PostCustomPriceSchemaType = z.infer<typeof PostCustomPriceSchema>

export async function POST(
  req: MedusaRequest<PostCustomPriceSchemaType>,
  res: MedusaResponse
) {
  const { id: variantId } = req.params
  const { 
    region_id,
    metadata,
  } = req.validatedBody

  const { result: price } = await getCustomPriceWorkflow(req.scope).run({
    input: {
      variant_id: variantId,
      region_id,
      metadata,
    },
  })

  res.json({
    price,
  })
}
