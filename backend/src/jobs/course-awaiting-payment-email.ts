import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { sendCourseReservationConfirmedEmail } from "../lib/course-emails"
import { reconcileCourseReservationPayment } from "../lib/course-payment-reconcile"

/**
 * „Vaše rezervace čeká na platbu" — jen když platba za 2 minuty nedorazila.
 *
 * Dřív odcházel hned po odeslání formuláře, takže ho dostal i každý, kdo
 * zaplatil během minuty — a o vteřiny později druhý e-mail „zaplaceno".
 * Působilo to divně (uživatel 27. 10. 2026). Teď:
 *
 * - zaplatí do 2 minut → přijde jen potvrzení platby (s pozvánkou a fakturou),
 * - nezaplatí → po 2 minutách přijde tenhle e-mail s odkazem, jak platbu
 *   dokončit; místo se drží 24 hodin (`expire-course-payments`).
 *
 * Před odesláním se ještě zeptá brány (`reconcileCourseReservationPayment`):
 * kdo zaplatil a jen ještě nedorazilo oznámení, dostane potvrzení platby, ne
 * výzvu. Okno 2–15 minut po založení: starší rezervace se už neprochází
 * (každá tak dostane nejvýš jeden pokus za minutu a e-mail jen jednou —
 * dedupe klíč `course-confirm:awaiting_payment:<id>`).
 */

const WAIT_MS = 2 * 60 * 1000
const WINDOW_MS = 15 * 60 * 1000

export default async function courseAwaitingPaymentEmail(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const now = Date.now()

  const candidates = (await courseService.listCourseReservations(
    {
      payment_method: "online",
      payment_status: "pending",
      status: "active",
      created_at: { $lte: new Date(now - WAIT_MS), $gte: new Date(now - WINDOW_MS) },
    } as never,
    { relations: ["term"] } as never
  )) as any[]

  for (const reservation of candidates) {
    try {
      if (!reservation.term) continue
      // Zaplaceno, jen oznámení ještě nepřišlo → potvrzení platby obstará subscriber.
      if (await reconcileCourseReservationPayment(container, reservation).catch(() => false)) continue
      await sendCourseReservationConfirmedEmail(container, reservation, reservation.term, {
        variant: "awaiting_payment",
      })
    } catch (error) {
      logger.warn(
        `[kurzy] E-mail „čeká na platbu" k rezervaci ${reservation.id} se nepodařilo poslat: ${
          error instanceof Error ? error.message : error
        }`
      )
    }
  }
}

export const config = {
  name: "course-awaiting-payment-email",
  schedule: "* * * * *",
}
