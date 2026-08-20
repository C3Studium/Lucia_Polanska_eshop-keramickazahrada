import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { sendCourseTermCancelledEmail } from "../../../../../../lib/course-emails"
import { refundCourseReservation } from "../../../../../../lib/course-refund"
import { refundSequentially } from "../../../../../../modules/course/lifecycle"
import { toAmount } from "../../../../../../modules/course/pricing"
import { serializeAdminTerm } from "../../../helpers"

/**
 * Cancelling a whole term.
 *
 * Marks the term cancelled, cancels every remaining reservation with
 * `cancel_reason: 'term_cancelled'`, and then — before any e-mail goes out —
 * attempts the automatic ComGate refund for every booking paid online, one
 * by one so a single dead payment cannot stop the rest. Only after the money
 * question is settled does the fan-out run, because the e-mail's wording
 * depends on the answer: refunded bookings are told the money is already on
 * its way, the rest keep the manual-return promise.
 *
 * The response gives the owner the full picture: how many e-mails went out,
 * whom to ring (no e-mail address), how many refunds ran automatically and
 * exactly which paid bookings still need the money returned by hand
 * (`refund_failed: true`).
 *
 * The term's waitlist is deliberately NOT notified — its people have no
 * reservation to cancel, and „uvolnilo se místo" on a cancelled term would
 * be an invitation to a course that no longer exists.
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
  const terms = (await courseService.listCourseTerms(
    { id: req.params.id } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  const term = terms[0]

  if (!term) {
    res.status(404).json({ message: "Termín nebyl nalezen." })
    return
  }
  if (term.status === "cancelled") {
    res.status(400).json({ message: "Termín už je zrušený." })
    return
  }

  await courseService.updateCourseTerms({
    id: term.id,
    status: "cancelled",
  } as never)
  term.status = "cancelled"

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const affected = (term.reservations ?? []).filter(
    (reservation: any) => reservation.status !== "cancelled"
  )

  // The reservations go down with the term — reason and all, so the admin
  // list can say in words why each row is cancelled.
  const cancelledAt = new Date()
  for (const reservation of affected) {
    await courseService
      .updateCourseReservations({
        id: reservation.id,
        status: "cancelled",
        cancelled_at: cancelledAt,
        cancel_reason: "term_cancelled",
      } as never)
      .catch((error) =>
        logger.error(
          `[kurzy] Rezervaci ${reservation.id} se nepodařilo označit jako zrušenou: ${
            error instanceof Error ? error.message : "neznámá chyba"
          }`
        )
      )
    reservation.status = "cancelled"
    reservation.cancelled_at = cancelledAt.toISOString()
    reservation.cancel_reason = "term_cancelled"
  }

  // Refunds first, e-mails second — the copy depends on the outcome.
  const paidOnline = affected.filter(
    (reservation: any) =>
      reservation.payment_method === "online" &&
      reservation.payment_status === "paid"
  )
  const refundedIds = new Set<string>()
  const { refunded } = await refundSequentially(
    paidOnline as { id: string }[],
    async (reservation) => {
      const outcome = await refundCourseReservation(req.scope, reservation)
      return (
        outcome.status === "refunded" || outcome.status === "already_refunded"
      )
    }
  )
  for (const reservation of refunded) {
    refundedIds.add(reservation.id)
  }

  let emailsSent = 0
  const withoutEmail: string[] = []
  for (const reservation of affected) {
    if (!reservation.email) {
      withoutEmail.push(reservation.name)
      continue
    }
    const sent = await sendCourseTermCancelledEmail(req.scope, reservation, term, {
      refundedAutomatically: refundedIds.has(reservation.id),
    }).catch((error) => {
      logger.error(
        `[kurzy] E-mail o zrušení termínu ${term.id} pro ${reservation.email} se nepodařilo odeslat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
      return false
    })
    if (sent) {
      emailsSent += 1
    }
  }

  const manual = paidOnline.filter(
    (reservation: any) => !refundedIds.has(reservation.id)
  )

  res.json({
    term: serializeAdminTerm(term),
    emails_sent: emailsSent,
    reservations_without_email: withoutEmail,
    /**
     * Every card-paid booking, with the one fact the owner needs per row:
     * was the money returned automatically, or is it on her (`refund_failed`)?
     */
    paid_online: paidOnline.map((reservation: any) => ({
      id: reservation.id,
      name: reservation.name,
      email: reservation.email ?? null,
      total_price: toAmount(reservation.total_price),
      refunded: refundedIds.has(reservation.id),
      refund_failed: !refundedIds.has(reservation.id),
    })),
    refunds: {
      refunded_count: refundedIds.size,
      manual_count: manual.length,
      manual_names: manual.map((reservation: any) => reservation.name),
    },
  })
}
