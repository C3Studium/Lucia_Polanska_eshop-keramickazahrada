import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { ensureCoursePaymentLink } from "../../../../../../lib/course-payment"
import { verifyCourseReservationToken } from "../../../../../../lib/course-reservation-link"

/**
 * „Zkusit zaplatit znovu" — the retry on the reservation page after a
 * cancelled or abandoned ComGate payment. Token-gated like the GET beside it;
 * idempotent because `ensureCoursePaymentLink` hands back the stored link
 * when one is still usable.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const reservationId = req.params.id

  if (!verifyCourseReservationToken(reservationId, req.query.token)) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const reservations = (await courseService.listCourseReservations(
    { id: reservationId } as never,
    { relations: ["term"] } as never
  )) as any[]
  const reservation = reservations[0]

  if (!reservation || !reservation.term) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  if (reservation.payment_method !== "online") {
    res.status(400).json({ message: "Tato rezervace se platí na místě." })
    return
  }
  if (reservation.term.status !== "published") {
    res.status(400).json({ message: "Tento termín už není v nabídce." })
    return
  }
  if (new Date(reservation.term.starts_at).getTime() <= Date.now()) {
    res.status(400).json({ message: "Tento termín už proběhl." })
    return
  }

  try {
    const link = await ensureCoursePaymentLink(req.scope, {
      reservation,
      term: reservation.term,
    })
    res.json({ payment_url: link.payment_url })
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({ message: error.message })
      return
    }
    req.scope
      .resolve("logger")
      .error(
        `[kurzy] Opakovanou platbu rezervace ${reservationId} se nepodařilo založit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    res.status(502).json({
      message: "Platbu se teď nepodařilo založit. Zkuste to prosím za chvíli.",
    })
  }
}
