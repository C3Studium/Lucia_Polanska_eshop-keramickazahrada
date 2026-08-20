import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { hasTermEnded } from "../modules/course/lifecycle"

/**
 * Marks published terms that have already happened as `finished` — nightly,
 * so the owner never has to.
 *
 * The admin's „Proběhlé a zrušené" tab already groups by time, but the
 * *stored* status used to stay `published` forever, which meant every
 * published-status query (the storefront list filters by date too, but
 * anything new would have to remember to) dragged history along. This makes
 * the status match reality.
 *
 * The cutoff is the term's *end*: `starts_at` plus the duration when one is
 * set, `starts_at` alone otherwise — a course that started an hour ago and
 * runs three hours is still happening, not finished. Idempotent by
 * construction: it only ever touches `published` terms whose end is past,
 * and after one pass those are `finished`. No e-mails, no notifications —
 * nothing here is news to anyone.
 */
export default async function finishCourseTerms(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  const now = new Date()
  // `starts_at < now` narrows the scan; the duration-aware check decides.
  const candidates = (await courseService.listCourseTerms(
    {
      status: "published",
      starts_at: { $lt: now },
    } as never
  )) as any[]

  let finished = 0
  for (const term of candidates) {
    if (!hasTermEnded(term, now)) {
      continue
    }
    try {
      await courseService.updateCourseTerms({
        id: term.id,
        status: "finished",
      } as never)
      finished += 1
    } catch (error) {
      logger.error(
        `[kurzy] Termín ${term.id} se nepodařilo označit jako proběhlý: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }

  if (finished) {
    logger.info(
      `[kurzy] Označeno ${finished} ${finished === 1 ? "proběhlý termín" : finished < 5 ? "proběhlé termíny" : "proběhlých termínů"}.`
    )
  }
}

export const config = {
  name: "finish-course-terms",
  // 02:00 — a quiet hour; the only reader of the result is the next morning.
  schedule: "0 2 * * *",
}
