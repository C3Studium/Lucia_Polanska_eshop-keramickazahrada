import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  cancelProductionForClaim,
  type CancelProductionBody,
} from "../../../../../lib/claims/cancel-production-action"

/**
 * POST /admin/return-requests/:id/cancel-production — „Zrušit zakázku" ze
 * žádosti (docs/reklamace-a-zruseni.md §12.4). Tělo `{ keep_deposit?, note? }`.
 * Pravidla a pořadí kroků v `lib/claims/cancel-production-action.ts`; tady
 * jen HTTP obal.
 */
export const POST = async (
  req: MedusaRequest<CancelProductionBody>,
  res: MedusaResponse
) => {
  const result = await cancelProductionForClaim(
    req.scope,
    req.params.id,
    (req.body || {}) as CancelProductionBody,
    (req as any).auth_context?.actor_id || null
  )
  res.status(200).json(result)
}
