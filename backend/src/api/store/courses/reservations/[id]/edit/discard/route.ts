import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadReservationForSelfService } from "../../self-service"
import { cancelPendingSupplements } from "../../../../../../../lib/course-party-change"

/**
 * POST /store/courses/reservations/:id/edit/discard?token=… — „Zrušit změnu":
 * zahodí rozpracovanou změnu počtu osob (čekající doplatek). Rezervace zůstane,
 * jak byla — změna se do ní nikdy nepropsala.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reservation = await loadReservationForSelfService(req, req.params.id)
  if (!reservation) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  await cancelPendingSupplements(req.scope, reservation.id)
  res.json({ ok: true })
}
