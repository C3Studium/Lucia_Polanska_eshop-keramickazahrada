import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { claimService, retrieveClaim } from "../../../../../lib/claims/admin"
import { isFinalStatus } from "../../../../../lib/claims/constants"

/**
 * POST /admin/return-requests/:id/cancel — žádost stažena / stornována
 * (docs/reklamace-a-zruseni.md §3–4). Z kteréhokoli nefinálního stavu →
 * `cancelled`. Žádný e-mail zákazníkovi: storno je obvykle výsledek domluvy
 * (zákazník si to rozmyslel, založil novou žádost), ne rozhodnutí o nároku.
 *
 * NEplete se se zrušením objednávky (`cancel-order`) — tady se uzavírá jen
 * žádost, objednávka žije dál.
 */

type CancelBody = { note?: string | null }

export const POST = async (
  req: MedusaRequest<CancelBody>,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as CancelBody
  const note = typeof body.note === "string" ? body.note.trim() : ""

  const request = await retrieveClaim(req.scope, req.params.id)
  if (isFinalStatus(request.status)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Žádost je už uzavřená.")
  }

  const updated = await claimService(req.scope).updateReturnRequests({
    id: request.id,
    status: "cancelled",
    resolution_note: note || request.resolution_note || null,
  })

  res.status(200).json({ return_request: updated })
}
