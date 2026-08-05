import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { createRestockSubscriptionWorkflow } from "../../../workflows/create-restock-subscription"

/**
 * „Dejte mi vědět, až bude skladem."
 *
 * The schema is not decoration: this handler reads `req.validatedBody`, which
 * only exists once `validateAndTransformBody` has run. It was never registered
 * in `middlewares.ts`, so `validatedBody` was `undefined` and the first
 * property access threw — every request, every payload, a 500 with
 * `unknown_error` and nothing to go on. Registered now; the schema and the
 * middleware entry have to move together or the route breaks the same way.
 */
export const PostStoreRestockSubscriptionSchema = z.object({
  variant_id: z.string(),
  // Optional for a signed-in customer, whose address comes from the session.
  email: z.string().email().optional(),
  sales_channel_id: z.string().optional(),
})

type PostStoreCreateRestockSubscription = z.infer<
  typeof PostStoreRestockSubscriptionSchema
>

export async function POST(
  req: AuthenticatedMedusaRequest<PostStoreCreateRestockSubscription>,
  res: MedusaResponse
) {
  const salesChannelId = req.validatedBody.sales_channel_id || (
    req.publishable_key_context?.sales_channel_ids?.length ? 
      req.publishable_key_context?.sales_channel_ids[0] : undefined
  )
  if (!salesChannelId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one sales channel ID is required, either associated with the publishable API key or in the request body."
    )
  }
  if (!req.validatedBody.email && !req.auth_context?.actor_id) {
    // Nobody to tell. Without this the subscription is stored against nothing
    // and silently never notifies anyone.
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Zadejte prosím e-mail, na který máme napsat."
    )
  }

  await createRestockSubscriptionWorkflow(req.scope)
    .run({
      input: {
        variant_id: req.validatedBody.variant_id,
        sales_channel_id: salesChannelId,
        customer: {
          email: req.validatedBody.email,
          customer_id: req.auth_context?.actor_id,
        },
      },
    })

  return res.sendStatus(201)
}