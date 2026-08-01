import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { createReviewWorkflow } from "../../../workflows/create-review"

import { z } from "@medusajs/framework/zod"

export const PostStoreReviewSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  rating: z.preprocess(
    (val) => {
      if (val && typeof val === "string") {
        return parseInt(val)
      }
      return val
    },
    z.number().min(1).max(5)
  ),
  product_id: z.string(),
  first_name: z.string(),
  last_name: z.string()
})

type PostStoreReviewReq = z.infer<typeof PostStoreReviewSchema>

export const POST = async (
  req: AuthenticatedMedusaRequest<PostStoreReviewReq>,
  res: MedusaResponse
) => {
  const input = req.validatedBody
  const actorId = req.auth_context?.actor_id

  // Debug logs to trace creation
  // eslint-disable-next-line no-console
  console.log("[Reviews][POST] incoming body:", input)
  // eslint-disable-next-line no-console
  console.log("[Reviews][POST] actor_id:", actorId)

  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  try {
    const { result } = await createReviewWorkflow(req.scope)
      .run({
        input: {
          // ensure required fields are forwarded with correct types
          title: input.title,
          content: input.content,
          rating: input.rating,
          product_id: input.product_id,
          first_name: input.first_name,
          last_name: input.last_name,
          // add customer id
          customer_id: actorId
        }
      })

    // eslint-disable-next-line no-console
    console.log("[Reviews][POST] created:", result)
    res.json(result)
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[Reviews][POST] error:", error)

    // Check for "not found" style errors from the workflow
    if (error.message && (error.message.includes("does not exist") || error.message.includes("not found"))) {
      res.status(404).json({
        message: `Product with id ${input.product_id} not found`,
        detail: error.message
      })
      return
    }

    res.status(500).json({
      message: "An error occurred while creating review",
      detail: error.message || String(error)
    })
  }
}




