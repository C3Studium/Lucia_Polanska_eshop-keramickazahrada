import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { INQUIRY_STATUSES, setInquiryStatus } from "../../../../../lib/commission-inquiry-records"

/**
 * POST /admin/commission-inquiries/:id/status `{ status: "new" | "answered" | "done" }`
 * — jedno kliknutí na stránce Poptávky. Mění jen položky zvonku, které jsou
 * poptávkou (jiné notifikace touhle cestou upravit nejde).
 */
const StatusSchema = z.object({ status: z.enum(INQUIRY_STATUSES) })

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const parsed = StatusSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neznámý stav poptávky.")
  }

  const inquiry = await setInquiryStatus(req.scope, req.params.id, parsed.data.status)
  if (!inquiry) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tahle poptávka už neexistuje.")
  }

  res.json({ inquiry })
}
