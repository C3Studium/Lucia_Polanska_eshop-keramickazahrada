import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { refundCourseReservation } from "../../../../../../lib/course-refund"
import { notifyCourseWaitlist } from "../../../../../../lib/course-waitlist"
import { sendCourseReservationCancelledEmail } from "../../../../../../lib/course-emails"
import { serializeAdminReservation } from "../../../helpers"

/**
 * Cancelling one reservation frees its seats (capacity only counts
 * non-cancelled rows) and, when it was paid online, immediately attempts the
 * automatic ComGate refund. The response says exactly what happened:
 * `refunded` with the amount when the money is on its way back, or
 * `needs_manual_refund` when the automatic attempt could not run or failed —
 * only then does the admin UI keep telling the owner to return it by hand.
 *
 * Freed seats also wake the term's waitlist (best-effort — a failed
 * notification never fails the cancel).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const reservations = (await courseService.listCourseReservations(
    { id: req.params.id } as never,
    { relations: ["term"] } as never
  )) as any[]
  const reservation = reservations[0]

  if (!reservation) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  if (reservation.status === "cancelled") {
    res.status(400).json({ message: "Rezervace už je zrušená." })
    return
  }

  await courseService.updateCourseReservations({
    id: reservation.id,
    status: "cancelled",
    cancelled_at: new Date(),
    cancel_reason: "manual",
  } as never)
  reservation.status = "cancelled"
  reservation.cancelled_at = new Date().toISOString()
  reservation.cancel_reason = "manual"

  const paidOnline =
    reservation.payment_method === "online" &&
    reservation.payment_status === "paid"

  // The automatic refund — `refunded_at` guards against ever running twice.
  const refund = paidOnline
    ? await refundCourseReservation(req.scope, reservation)
    : null
  const refunded =
    refund?.status === "refunded" || refund?.status === "already_refunded"
  if (refund?.status === "refunded") {
    reservation.refunded_at = new Date().toISOString()
  }

  // The customer hears about their own cancellation — with the right money
  // story: refunded / we-will-return-it / nothing-was-paid. Best-effort and
  // keyed per reservation; a missing e-mail address skips quietly.
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  let customerEmailed = false
  if (reservation.email && reservation.term) {
    customerEmailed = await sendCourseReservationCancelledEmail(
      req.scope,
      reservation,
      reservation.term,
      {
        variant: !paidOnline
          ? "unpaid"
          : refunded
            ? "refunded"
            : "manual_refund",
      }
    ).catch((error) => {
      logger.error(
        `[kurzy] E-mail o zrušení rezervace ${reservation.id} se nepodařilo odeslat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
      return false
    })
  }

  // Seats came free — tell the waitlist (never a reason to fail the cancel).
  const termId = reservation.term_id ?? reservation.term?.id
  await notifyCourseWaitlist(req.scope, termId).catch((error) =>
    logger.error(
      `[kurzy] Upozornění čekatelů po zrušení rezervace ${reservation.id} selhalo: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  )

  res.json({
    reservation: serializeAdminReservation(reservation),
    /** Whether the cancellation e-mail reached the queue (false = no address). */
    customer_emailed: customerEmailed,
    /** True while money still has to be returned by hand. */
    needs_manual_refund: paidOnline && !refunded,
    refund: refund
      ? {
          attempted: refund.status !== "no_card_payment",
          refunded,
          amount: refund.amount,
        }
      : null,
  })
}
