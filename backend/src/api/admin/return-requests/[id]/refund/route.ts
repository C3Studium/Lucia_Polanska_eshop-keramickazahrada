import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  refundClaim,
  type RefundClaimBody,
} from "../../../../../lib/claims/refund-action"

/**
 * POST /admin/return-requests/:id/refund — vrácení peněz k jedné žádosti.
 * Logika (pravidla, ComGate, dobropis, protokol, e-mail) žije v
 * `lib/claims/refund-action.ts`, protože ji volá i „Schválit a vrátit peníze"
 * u odstoupení (route `decide` s `refund_now`). Tady jen HTTP obal.
 */
export const POST = async (
  req: MedusaRequest<RefundClaimBody>,
  res: MedusaResponse
) => {
  const result = await refundClaim(
    req.scope,
    req.params.id,
    (req.body || {}) as RefundClaimBody
  )
  res.status(200).json(result)
}
