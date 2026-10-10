import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildClaimDetail } from "../../../../../lib/claims/detail"

/**
 * GET /admin/return-requests/:id/detail — všechno pro stránku žádosti
 * (docs/reklamace-a-zruseni.md §12.2): žádost, objednávka, položky s tím, co
 * se ještě dá vrátit, peníze, zakázka, vlajky, případ + průběh + povolené
 * akce. Logika v `lib/claims/detail.ts`; tady jen HTTP obal.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json(await buildClaimDetail(req.scope, req.params.id))
}
