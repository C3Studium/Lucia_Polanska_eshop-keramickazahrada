import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { countInquiries, listInquiries } from "../../../lib/commission-inquiry-records"

/**
 * GET /admin/commission-inquiries — poptávky zakázek pro stránku Poptávky.
 *
 * Vrací všechny (nejnovější nahoře) i s počty po stavech; dělení na
 * „K vyřízení" a „Vyřízené" si dělá stránka — poptávek je málo a jeden
 * dotaz je jednodušší než tři. Zdroj viz `lib/commission-inquiry-records.ts`.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const inquiries = await listInquiries(req.scope)
  res.json({ inquiries, counts: countInquiries(inquiries) })
}
