import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import {
  expiryCutoff,
  shouldAutoExpire,
} from "../modules/course/lifecycle"
import { sendCoursePaymentExpiredEmail } from "../lib/course-emails"
import { notifyCourseWaitlist } from "../lib/course-waitlist"

/**
 * Releases online reservations whose card payment never arrived (24 hours).
 *
 * An unpaid online reservation blocks real seats — that is by design for the
 * first day (the customer may still be at the ComGate screen, or retrying),
 * and indefensible afterwards. Hourly, this cancels every online booking
 * still unpaid 24 hours after it was created; the seats free themselves,
 * because occupancy only ever counts non-cancelled rows.
 *
 * ## The race with a landing payment
 *
 * A payment can be captured between our query and our cancel. Two guards
 * make that harmless: the cancel itself is an *atomic conditional UPDATE*
 * (`expireUnpaidReservation` — the WHERE re-checks unpaid+active on the
 * current row version, so a capture that wins the race makes the update
 * match nothing), and a payment that still manages to land *after* the
 * cancel flows into the payment-captured subscriber's cancelled-reservation
 * branch — the owner is told loudly to send the money back, which is the
 * correct outcome for money without a seat.
 *
 * The customer hears once (`course-expired:{id}`): the payment did not
 * arrive, the seats went back on sale, the kurzy page has the fresh state.
 * The owner deliberately hears nothing — an expiry an hour is noise, and the
 * admin list shows „nezaplaceno (automaticky)" on the row anyway.
 */
export default async function expireCoursePayments(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  const now = new Date()
  const candidates = (await courseService.listCourseReservations(
    {
      payment_method: "online",
      payment_status: "pending",
      status: "active",
      created_at: { $lte: expiryCutoff(now) },
    } as never,
    { relations: ["term"] } as never
  )) as any[]

  if (!candidates.length) {
    return
  }

  let expired = 0
  const termsToWake = new Set<string>()

  for (const candidate of candidates) {
    try {
      // Cheap pre-check (also keeps the unit-tested rule in one place)…
      if (!shouldAutoExpire(candidate, new Date())) {
        continue
      }
      // …but the cancel itself is atomic: one conditional UPDATE whose WHERE
      // re-verifies „still unpaid, still active" on the current row version.
      // A payment captured a millisecond ago makes this return false —
      // cancelling a paid reservation is the one mistake this job must never
      // make, and a pre-read alone cannot rule it out.
      const wasExpired = await courseService.expireUnpaidReservation(
        candidate.id,
        expiryCutoff(new Date())
      )
      if (!wasExpired) {
        continue
      }
      expired += 1

      const term = candidate.term
      if (term) {
        termsToWake.add(term.id)
        await sendCoursePaymentExpiredEmail(container, candidate, term).catch(
          (error) =>
            logger.error(
              `[kurzy] E-mail o vypršelé platbě rezervace ${candidate.id} se nepodařilo odeslat: ${
                error instanceof Error ? error.message : "neznámá chyba"
              }`
            )
        )
      }

      logger.info(
        `[kurzy] Rezervace ${candidate.id} (${candidate.name}) po 24 h bez platby uvolněna.`
      )
    } catch (error) {
      // One stuck row must not stop the rest of the sweep.
      logger.error(
        `[kurzy] Expiraci rezervace ${candidate.id} se nepodařilo dokončit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }

  /* Retry sweep: a waitlist e-mail that failed at the moment seats freed
     (mail provider down) leaves `notified_at` NULL — and if no further
     cancellation ever comes, nobody would retry. So every hourly run also
     wakes any term that still has un-notified waiters; `notifyCourseWaitlist`
     itself re-checks published/future/free-seats/fit, so terms with nothing
     to say cost one cheap read and no mail. */
  try {
    const pending = (await courseService.listCourseWaitlists(
      { notified_at: null } as never,
      { select: ["term_id"], take: 500 } as never
    )) as { term_id: string }[]
    for (const entry of pending) {
      termsToWake.add(entry.term_id)
    }
  } catch (error) {
    logger.error(
      `[kurzy] Kontrolu nedoručených zpráv čekatelům se nepodařilo načíst: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  }

  // Freed seats wake each affected term's waitlist exactly once per run.
  for (const termId of termsToWake) {
    await notifyCourseWaitlist(container, termId).catch((error) =>
      logger.error(
        `[kurzy] Upozornění čekatelů termínu ${termId} po expiraci selhalo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    )
  }

  if (expired) {
    logger.info(`[kurzy] Uvolněno ${expired} nezaplacených rezervací.`)
  }
}

export const config = {
  name: "expire-course-payments",
  // Hourly at :25 — offset from expire-customer-edits (:15) so the two
  // sweeps never contend, and comfortably clear of full-hour cron bursts.
  schedule: "25 * * * *",
}
