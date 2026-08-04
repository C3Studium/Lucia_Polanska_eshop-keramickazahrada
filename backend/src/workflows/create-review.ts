import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createReviewStep } from "./steps/create-review"
import { emitEventStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"

type CreateReviewInput = {
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  first_name: string
  last_name: string
  status?: "čeká na schválení" | "schváleno" | "zamítnuto"
}

export const createReviewWorkflow = createWorkflow(
  "create-review",
  (input: CreateReviewInput) => {
    // Check product exists
    const products = useQueryGraphStep({
      entity: "product",
      fields: ["id", "title"],
      filters: {
        id: input.product_id
      },
      options: {
        throwIfKeyNotFound: true
      }
    }).config({ name: "check-product-exists" })

    // Create the review
    const review = createReviewStep(input)

    // Every review is moderated by hand (D5), so a new one is work waiting for
    // her. The product title travels with the event because the notification
    // has to name the product and the review row only carries its id.
    emitEventStep({
      eventName: "review.created",
      data: transform({ review, products, input }, ({ review, products, input }) => ({
        id: (review as { id?: string })?.id,
        rating: input.rating,
        product_id: input.product_id,
        product_title: (products?.data?.[0] as { title?: string })?.title ?? null,
      })),
    })

    return new WorkflowResponse({
      review
    }) as unknown as WorkflowResponse<{ review: unknown }>
  }
)


