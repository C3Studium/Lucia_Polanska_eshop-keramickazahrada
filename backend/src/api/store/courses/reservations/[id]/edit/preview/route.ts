import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { loadReservationForSelfService } from "../../self-service"
import { previewCoursePartyChange } from "../../../../../../../lib/course-party-change"

/**
 * POST /store/courses/reservations/:id/edit/preview?token=… — shrnutí změny
 * počtu osob před potvrzením (nová cena, zaplaceno, doplatek / vrácení).
 * Nic neukládá.
 */
const Body = z.object({ party_size: z.number().int().min(1).max(30) })

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = Body.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Zadejte prosím počet osob od 1 do 30." })
    return
  }
  const reservation = await loadReservationForSelfService(req, req.params.id)
  if (!reservation || reservation.status !== "active") {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    preview: await previewCoursePartyChange(req.scope, {
      reservation,
      term: reservation.term,
      partySize: parsed.data.party_size,
    }),
  })
}
