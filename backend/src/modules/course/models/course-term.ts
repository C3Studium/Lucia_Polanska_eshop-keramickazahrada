import { model } from "@medusajs/framework/utils"
import { CourseReservation } from "./course-reservation"
import { CourseWaitlist } from "./course-waitlist"

/**
 * One dated course session the owner opens for booking.
 *
 * Prices are stored in CZK major units, exactly as the owner types them:
 * `price_single` per person, an optional `price_two` per person when two come
 * together, and an optional group rate (`price_group_per_person`) that applies
 * from `group_min` people. The tier arithmetic lives in `../pricing.ts` — the
 * model only holds the numbers.
 */
export const CourseTerm = model.define("course_term", {
  id: model.id().primaryKey(),
  title: model.text(),
  location: model.text(),
  starts_at: model.dateTime().index(),
  duration_minutes: model.number().nullable(),
  capacity: model.number(),
  price_single: model.bigNumber(),
  price_two: model.bigNumber().nullable(),
  group_min: model.number().nullable(),
  price_group_per_person: model.bigNumber().nullable(),
  status: model
    .enum(["draft", "published", "cancelled", "finished"])
    .index()
    .default("draft"),
  note: model.text().nullable(),
  reservations: model.hasMany(() => CourseReservation, {
    mappedBy: "term",
  }),
  waitlist: model.hasMany(() => CourseWaitlist, {
    mappedBy: "term",
  }),
})
