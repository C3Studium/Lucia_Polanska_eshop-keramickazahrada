import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { countInquiries, listInquiries } from "../../../../lib/commission-inquiry-records"

/**
 * GET /admin/commission-inquiries/counts → `{ new: n }` — počet poptávek,
 * na které ještě nikdo neodpověděl. Pro dlaždici na Přehledu.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const counts = countInquiries(await listInquiries(req.scope))
  res.json({ new: counts.new })
}
