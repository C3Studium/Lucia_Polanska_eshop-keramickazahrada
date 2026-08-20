import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { toAmount } from "../../../../../modules/course/pricing"
import { verifyCourseReservationToken } from "../../../../../lib/course-reservation-link"

/**
 * One reservation, for whoever holds its signed link.
 *
 * The ComGate return pages and the confirmation e-mail both land here without
 * a session, so access is proven by the HMAC token instead. The response is
 * deliberately narrow — what the booker needs to see, not the whole row.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
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

  res.json({
    reservation: {
      id: reservation.id,
      name: reservation.name,
      party_size: reservation.party_size,
      pricing_tier: reservation.pricing_tier,
      total_price: toAmount(reservation.total_price),
      payment_method: reservation.payment_method,
      payment_status: reservation.payment_status,
      status: reservation.status,
      /** Why a cancelled row was cancelled — the page words self-cancels differently. */
      cancel_reason: reservation.cancel_reason ?? null,
      /** Stamped once the automatic refund ran — the page may promise money truthfully. */
      refunded_at: reservation.refunded_at ?? null,
      invoice_pdf_url: reservation.idoklad_pdf_url ?? null,
      term: {
        id: reservation.term.id,
        title: reservation.term.title,
        location: reservation.term.location,
        starts_at: reservation.term.starts_at,
        duration_minutes: reservation.term.duration_minutes ?? null,
        status: reservation.term.status,
      },
    },
  })
}
