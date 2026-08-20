import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../modules/course"
import type CourseModuleService from "../../../../modules/course/service"
import { seatsLeft, seatsTaken, toAmount } from "../../../../modules/course/pricing"

/**
 * Published upcoming terms, with live occupancy and the pricing rules.
 *
 * The prices returned here are *display material* — the reservation section
 * shows „za jednoho / za dva / skupina od X" from them and previews the total,
 * but the authoritative price is always recomputed server-side (quote endpoint
 * and again inside the reservation create). Sold-out terms are included with
 * `seats_left: 0` so the page can say „obsazeno" instead of the term silently
 * vanishing.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const terms = (await courseService.listCourseTerms(
    {
      status: "published",
      starts_at: { $gt: new Date() },
    } as never,
    {
      relations: ["reservations"],
      order: { starts_at: "ASC" },
    } as never
  )) as any[]

  res.json({
    terms: terms.map((term) => {
      const reservations = term.reservations ?? []
      const left = seatsLeft(term.capacity, reservations)
      return {
        id: term.id,
        title: term.title,
        location: term.location,
        starts_at: term.starts_at,
        duration_minutes: term.duration_minutes ?? null,
        capacity: Math.trunc(toAmount(term.capacity)),
        seats_taken: seatsTaken(reservations),
        seats_left: left,
        sold_out: left <= 0,
        price_single: toAmount(term.price_single),
        price_two: term.price_two != null ? toAmount(term.price_two) : null,
        group_min: term.group_min != null ? Math.trunc(toAmount(term.group_min)) : null,
        price_group_per_person:
          term.price_group_per_person != null
            ? toAmount(term.price_group_per_person)
            : null,
      }
    }),
  })
}
