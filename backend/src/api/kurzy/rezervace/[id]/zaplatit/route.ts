import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { ensureCoursePaymentLink } from "../../../../../lib/course-payment"
import { ensureCourseSupplementLink, pendingCourseChange } from "../../../../../lib/course-party-change"
import { toAmount } from "../../../../../modules/course/pricing"
import {
  courseReservationLink,
  verifyCourseReservationToken,
} from "../../../../../lib/course-reservation-link"

/**
 * GET /kurzy/rezervace/:id/zaplatit?token=… — tlačítko „Zaplatit" z e-mailu.
 *
 * Mimo /store schválně: z e-mailu nejde poslat publishable key (stejně jako
 * `/made-to-order/:orderId/pay-balance`). Ověří podepsaný token, platbu založí
 * nebo vrátí ještě živou (`ensureCoursePaymentLink` se ptá brány, zrušenou
 * nevrátí) a přesměruje na ComGate. Když platit nejde (zaplaceno, zrušeno,
 * termín proběhl), pošle zákazníka na stránku rezervace, kde uvidí proč.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const reservationId = req.params.id
  const fallback = courseReservationLink(reservationId)

  if (!verifyCourseReservationToken(reservationId, req.query.token)) {
    res.status(404).send("Rezervace nebyla nalezena.")
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const [reservation] = (await courseService.listCourseReservations(
    { id: reservationId } as never,
    { relations: ["term"] } as never
  )) as any[]

  // Doplatek po úpravě počtu osob: zaplacená rezervace, ale něco zbývá.
  const supplementDue =
    reservation?.payment_status === "paid" &&
    (toAmount(reservation?.amount_due) > 0 ||
      Boolean(reservation && (await pendingCourseChange(req.scope, reservation.id))))
  const payable =
    reservation?.term &&
    reservation.payment_method === "online" &&
    (reservation.payment_status !== "paid" || supplementDue) &&
    reservation.status !== "cancelled" &&
    reservation.term.status === "published" &&
    new Date(reservation.term.starts_at).getTime() > Date.now()

  if (!payable) {
    if (fallback) res.redirect(303, fallback)
    else res.status(404).send("Rezervaci teď nejde zaplatit.")
    return
  }

  try {
    const link = supplementDue
      ? await ensureCourseSupplementLink(req.scope, { reservation, term: reservation.term })
      : await ensureCoursePaymentLink(req.scope, { reservation, term: reservation.term })
    res.redirect(303, link.payment_url)
  } catch (error) {
    req.scope
      .resolve("logger")
      .warn(
        `[kurzy] Platbu z e-mailu k rezervaci ${reservationId} se nepodařilo otevřít: ${
          error instanceof Error ? error.message : error
        }`
      )
    if (fallback) res.redirect(303, `${fallback}&vysledek=cancelled`)
    else res.status(502).send("Platbu se teď nepodařilo otevřít. Zkuste to prosím za chvíli.")
  }
}
