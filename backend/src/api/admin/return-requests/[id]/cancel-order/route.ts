import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderForClaim } from "../../../../../lib/claims/cancel-order-action"

/**
 * POST /admin/return-requests/:id/cancel-order — zrušit objednávku a uvolnit
 * sklad po odstoupení / vrácení. Logika v `lib/claims/cancel-order-action.ts`
 * (sdílená se „Schválit, vrátit peníze a zrušit"); tady jen HTTP obal.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await cancelOrderForClaim(
    req.scope,
    req.params.id,
    (req as any).auth_context?.actor_id || null
  )
  res.status(200).json(result)
}
