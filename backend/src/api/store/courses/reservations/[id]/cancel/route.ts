import { syncCourseMoney } from "../../../../../../lib/course-money"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import {
  COURSE_SELF_SERVICE_TOO_LATE,
  CUSTOMER_CANCEL_REASON,
  isBeforeSelfServiceCutoff,
} from "../../../../../../modules/course/lifecycle"
import { refundCourseReservation } from "../../../../../../lib/course-refund"
import { notifyCourseWaitlist } from "../../../../../../lib/course-waitlist"
import {
  formatCourseDate,
  sendCourseReservationCancelledEmail,
} from "../../../../../../lib/course-emails"
import { notifyMerchant } from "../../../../../../lib/notify"
import { loadReservationForSelfService } from "../self-service"

/**
 * „Zrušit rezervaci" — the customer cancels their own booking.
 *
 * Access is the token OR the logged-in owner of the reservation (see
 * `../self-service.ts`). Allowed until 24 hours before the term starts —
 * after that the route refuses with a Czech ask-to-call message, because
 * inside that window the owner plans material and seats around the headcount.
 *
 * The consequences mirror the owner's own cancel route exactly, just with
 * `cancel_reason: 'customer'`: seats free themselves (occupancy only counts
 * non-cancelled rows), a paid card payment is refunded automatically
 * (`refunded_at` guards against ever refunding twice), the waitlist wakes,
 * the customer gets the cancellation e-mail with the right money story, and
 * the owner's bell says who cancelled and whether money still needs returning
 * by hand. Every send is idempotency-keyed, so a retried request repeats
 * nothing.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const reservation = await loadReservationForSelfService(req, req.params.id)

  if (!reservation) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  if (reservation.status === "cancelled") {
    res.status(400).json({ message: "Rezervace už je zrušená." })
    return
  }
  const term = reservation.term
  if (term.status !== "published") {
    res.status(400).json({
      message: "Tento termín už není v nabídce — rezervaci vyřešíme spolu, ozvěte se mi prosím.",
    })
    return
  }
  /*
   * Po uplynutí samoobslužné lhůty se nezruší, ale PODÁ SE ŽÁDOST.
   *
   * Dřív tu stálo jen 400 s větou „zavolejte mi prosím". Zákazník tedy
   * musel zvednout telefon a majitelce o tom nezůstal žádný záznam — ani
   * o tom, že někdo zrušit chtěl. Storno podmínky (Matěj, 20. 10. 2026)
   * přitom počítají právě s tím, že pozdní zrušení se řeší individuálně:
   * tohle je to „individuálně", jen zapsané.
   *
   * Druhá žádost nic nepřepisuje — jedna rezervace, jedna otevřená žádost.
   */
  if (!isBeforeSelfServiceCutoff(term.starts_at, new Date())) {
    const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

    if (reservation.cancel_request_status === "pending") {
      res.status(200).json({
        status: "request_pending",
        message:
          "Žádost o zrušení už evidujeme — ozveme se vám, jakmile ji vyřídíme.",
      })
      return
    }

    const note =
      typeof (req.body as { reason?: unknown } | undefined)?.reason === "string"
        ? String((req.body as { reason?: string }).reason).trim().slice(0, 1000)
        : null

    await courseService.updateCourseReservations({
      id: reservation.id,
      cancel_request_status: "pending",
      cancel_requested_at: new Date(),
      cancel_request_note: note || null,
      // Starší rozhodnutí nesmí strašit u nové žádosti.
      cancel_decided_at: null,
      cancel_decision_note: null,
    } as never)

    await notifyMerchant(req.scope, {
      key: `course-cancel-request:${reservation.id}`,
      title: `Kurzy: žádost o zrušení — ${reservation.name}`,
      description: [
        `${term.title} · ${formatCourseDate(term.starts_at)}`,
        `${reservation.party_size} os. · ${reservation.name}${
          reservation.email ? ` <${reservation.email}>` : ""
        }${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
        reservation.payment_status === "paid"
          ? "Zaplaceno — při schválení rozhodnete, jestli peníze vrátit."
          : "Nezaplaceno.",
        note ? `Důvod: ${note}` : "Důvod neuveden.",
        "Vyřídíte v Kurzech v záložce „Žádosti o zrušení“.",
      ].join("\n"),
      audience: "owner",
      email: true,
    }).catch(() => undefined)

    res.status(200).json({
      status: "request_created",
      message:
        "Do začátku kurzu zbývá méně než 24 hodin, takže zrušení posoudíme osobně. Žádost jsme přijali a ozveme se vám.",
    })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  // Atomic conditional cancel: only one of two racing tabs performs it (the
  // other is told the reservation is already cancelled), and the returned row
  // carries the payment fields as of the cancel itself — so a ComGate capture
  // that landed between our read above and this write still gets its refund.
  const cancelled = await courseService.cancelReservationByCustomer(
    reservation.id
  )
  if (!cancelled) {
    res.status(400).json({ message: "Rezervace už je zrušená." })
    return
  }
  reservation.status = "cancelled"
  reservation.cancelled_at = cancelled.cancelled_at ?? new Date().toISOString()
  reservation.cancel_reason = CUSTOMER_CANCEL_REASON
  reservation.payment_status = cancelled.payment_status
  reservation.paid_at = cancelled.paid_at ?? null
  reservation.payment_collection_id = cancelled.payment_collection_id ?? null
  reservation.refunded_at = cancelled.refunded_at ?? null

  const paidOnline =
    reservation.payment_method === "online" &&
    (reservation.payment_status === "paid" || Boolean(reservation.paid_at))

  // The automatic refund — `refunded_at` guards against ever running twice.
  const refund = paidOnline
    ? await refundCourseReservation(req.scope, reservation)
    : null
  const refunded =
    refund?.status === "refunded" || refund?.status === "already_refunded"
  if (refund?.status === "refunded") {
    reservation.refunded_at = new Date().toISOString()
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // The customer's written confirmation of what they just did — with the
  // right money story. Keyed per reservation, so retries send nothing twice.
  if (reservation.email) {
    await sendCourseReservationCancelledEmail(req.scope, reservation, term, {
      variant: !paidOnline ? "unpaid" : refunded ? "refunded" : "manual_refund",
      cancelledByCustomer: true,
    }).catch((error) =>
      logger.error(
        `[kurzy] E-mail o zrušení rezervace ${reservation.id} se nepodařilo odeslat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    )
  }

  // Seats came free — tell the waitlist (never a reason to fail the cancel).
  await notifyCourseWaitlist(req.scope, reservation.term_id ?? term.id).catch(
    (error) =>
      logger.error(
        `[kurzy] Upozornění čekatelů po zrušení rezervace ${reservation.id} selhalo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
  )

  // The owner hears about it — with the money instruction spelled out.
  await notifyMerchant(req.scope, {
    key: `course-res-customer-cancel:${reservation.id}`,
    title: `Kurzy: zákazník zrušil rezervaci — ${reservation.name}`,
    description: [
      `${term.title} · ${formatCourseDate(term.starts_at)}`,
      `${reservation.party_size} os. · ${reservation.name}${
        reservation.email ? ` <${reservation.email}>` : ""
      }${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
      !paidOnline
        ? "Nebylo zaplaceno online — není co vracet."
        : refunded
          ? "Peníze vráceny automaticky."
          : "Zaplaceno kartou — vraťte prosím peníze ručně.",
    ].join("\n"),
    audience: "owner",
    email: true,
  }).catch(() => undefined)

  // Evidence peněz (zaplaceno / zbývá) po změně — lib/course-money.
  await syncCourseMoney(req.scope, req.params.id).catch(() => null)
  res.json({
    ok: true,
    /** Money is (or already was) on its way back to the card. */
    refunded: paidOnline && refunded,
    /** True while the owner still has to return the money by hand. */
    needs_manual_refund: paidOnline && !refunded,
  })
}
