import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { syncDobirkaFeeForCart } from "../../../../../lib/dobirka-fee"

export const PostPaymentChoiceSchema = z.object({
  provider_id: z.string().min(1),
})

type PostPaymentChoiceSchemaType = z.infer<typeof PostPaymentChoiceSchema>

/**
 * Display sync for the doběrečné line: the checkout tells the cart which
 * payment provider the customer is heading towards, and the fee line follows
 * — so the recap the customer reads is already right, before any session.
 *
 * This is deliberately NOT the enforcement point. The fee is enforced where
 * it cannot be skipped: the payment-session route adds/removes it when the
 * session is created, and `validate-dobirka` refuses completion of a cart
 * whose fee does not match its payment. Calling this route with a mismatched
 * provider only produces a cart the completion check will reject.
 */
export async function POST(
  req: MedusaRequest<PostPaymentChoiceSchemaType>,
  res: MedusaResponse
) {
  const { changed } = await syncDobirkaFeeForCart(
    req.scope,
    req.params.id,
    req.validatedBody.provider_id
  )

  res.status(200).json({ synced: changed })
}
