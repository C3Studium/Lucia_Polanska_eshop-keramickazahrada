import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { seatsLeft } from "../modules/course/pricing"
import { waitlistEntriesToNotify } from "../modules/course/lifecycle"
import { sendCourseWaitlistSpotEmail } from "./course-emails"

/**
 * The seat-freeing hook: called after anything that can open seats on a term
 * — a manual reservation cancel, the 24h auto-expiry, a capacity increase.
 *
 * It re-reads the term with fresh occupancy (the caller's view may be stale
 * by the time we run) and e-mails every not-yet-notified waitlist entry whose
 * whole party fits into the seats free right now, oldest first. Seats are
 * not held: the e-mail says so, and the reservation form's row lock is the
 * arbiter of who actually gets them.
 *
 * Cancelled, draft and past terms never notify — freeing seats on a term
 * nobody can book is not news anyone can act on. Term cancellation therefore
 * simply never produces waitlist mail, exactly as intended.
 *
 * Failures are contained twice over: per entry (one dead address must not
 * silence the rest) and as a whole (`.catch` at every call site — the hook
 * is a courtesy, never a reason for a cancel or a PATCH to fail).
 */
export const notifyCourseWaitlist = async (
  container: MedusaContainer,
  termId: string
): Promise<{ notified: number }> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  const terms = (await courseService.listCourseTerms(
    { id: termId } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  const term = terms[0]

  if (
    !term ||
    term.status !== "published" ||
    new Date(term.starts_at).getTime() <= Date.now()
  ) {
    return { notified: 0 }
  }

  const free = seatsLeft(term.capacity, term.reservations ?? [])
  if (free <= 0) {
    return { notified: 0 }
  }

  const entries = (await courseService.listCourseWaitlists(
    { term_id: termId, notified_at: null } as never,
    { order: { created_at: "ASC" } } as never
  )) as any[]

  const toNotify = waitlistEntriesToNotify(entries, free)
  let notified = 0

  for (const entry of toNotify) {
    try {
      const sent = await sendCourseWaitlistSpotEmail(container, entry, term)
      // `notified_at` is stamped even when the address was unusable — an
      // entry the mailer refuses once is not going to fare better tomorrow,
      // and leaving it unstamped would retry it on every freed seat forever.
      await courseService.updateCourseWaitlists({
        id: entry.id,
        notified_at: new Date(),
      } as never)
      if (sent) {
        notified += 1
      }
    } catch (error) {
      logger.error(
        `[kurzy] Čekateli ${entry.email} se nepodařilo poslat zprávu o uvolněném místě: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }

  if (notified) {
    logger.info(
      `[kurzy] Termín ${term.title}: ${notified}× posláno „uvolnilo se místo" čekajícím.`
    )
  }

  return { notified }
}
