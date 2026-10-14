import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createReviewStep } from "./steps/create-review"
import { guardReviewSpamStep } from "./steps/guard-review-spam"
import { verifyReviewPurchaseStep } from "./steps/verify-review-purchase"
import { emitEventStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"

type CreateReviewInput = {
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  first_name: string
  last_name: string
  status?: "čeká na schválení" | "schváleno" | "zamítnuto" | "archivováno"
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

    // §12 spam guard. Every review is moderated by hand (D5), so a flood does
    // not reach the storefront — it reaches a queue she has to read. This
    // protects her attention rather than the shop's reputation.
    guardReviewSpamStep({
      product_id: input.product_id,
      customer_id: input.customer_id,
      first_name: input.first_name,
      last_name: input.last_name,
    })

    // „Ověřený nákup" (§ 5 ZOS) — rozhoduje server podle objednávek
    // recenzenta, ne formulář. Vstup workflow pole záměrně nemá.
    const verifiedPurchase = verifyReviewPurchaseStep({
      product_id: input.product_id,
      customer_id: input.customer_id,
    })

    // Create the review
    const review = createReviewStep(
      transform({ input, verifiedPurchase }, ({ input, verifiedPurchase }) => ({
        title: input.title,
        content: input.content,
        rating: input.rating,
        product_id: input.product_id,
        customer_id: input.customer_id,
        first_name: input.first_name,
        last_name: input.last_name,
        status: input.status,
        verified_purchase: verifiedPurchase === true,
      }))
    )

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


