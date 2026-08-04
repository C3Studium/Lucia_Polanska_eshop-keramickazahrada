import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Stops the same person reviewing the same piece twice, and stops one person
 * flooding the shop (§12, P9-1).
 *
 * ## Why it matters here specifically
 *
 * Every review is moderated by hand (D5), so spam is not a publishing problem —
 * it is *her* problem. Ten fake reviews do not reach the storefront, they reach
 * a queue she has to read and reject one at a time. The guard protects her
 * attention, which is the scarce thing.
 *
 * Two rules, both from §12:
 *
 * 1. **One review per customer per product.** A second is either a mistake or
 *    an attempt to weight the average.
 * 2. **At most three per name per day.** Deliberately generous — a genuinely
 *    happy customer who bought four things should be able to say so about all
 *    four.
 *
 * Errors are Czech, because the storefront shows them to the customer verbatim.
 */

export type ReviewSpamGuardInput = {
  product_id: string
  customer_id?: string | null
  first_name: string
  last_name: string
}

/** §12: „same email > 3/day". Customers are identified by name when not signed in. */
export const MAX_REVIEWS_PER_DAY = 3

export const guardReviewSpamStep = createStep(
  "guard-review-spam",
  async (input: ReviewSpamGuardInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    if (input.customer_id) {
      const { data: existing } = await query.graph({
        entity: "review",
        fields: ["id"],
        filters: {
          product_id: input.product_id,
          customer_id: input.customer_id,
        },
      })

      if ((existing as any[]).length) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Tento produkt už jste hodnotili. Děkujeme!"
        )
      }
    }

    // Rate limit by name over the last 24 hours. Not airtight — somebody
    // determined can change the name — but it costs nothing and stops the
    // accidental double-submit and the bored visitor, which is what actually
    // happens to a shop this size.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { data: recent } = await query.graph({
      entity: "review",
      fields: ["id"],
      filters: {
        first_name: input.first_name,
        last_name: input.last_name,
        created_at: { $gte: since },
      },
    })

    if ((recent as any[]).length >= MAX_REVIEWS_PER_DAY) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Dnes jste už poslali několik hodnocení. Zkuste to prosím zítra."
      )
    }

    return new StepResponse(true)
  }
)
