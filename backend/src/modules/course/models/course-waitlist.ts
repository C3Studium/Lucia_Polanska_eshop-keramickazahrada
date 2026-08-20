import { model } from "@medusajs/framework/utils"
import { CourseTerm } from "./course-term"

/**
 * One person waiting for a full term to free up.
 *
 * Deliberately tiny: name, e-mail and how many they are — the e-mail is used
 * for exactly one „uvolnilo se místo" notification (the storefront form says
 * so out loud), and `notified_at` is what keeps it to one. Seats are never
 * *held* for a waitlist entry; the notification says the reservation form is
 * open again and whoever finishes first wins, which is the only promise a
 * first-come-first-served system can keep honestly.
 */
export const CourseWaitlist = model.define("course_waitlist", {
  id: model.id().primaryKey(),
  term: model.belongsTo(() => CourseTerm, {
    mappedBy: "waitlist",
  }),
  name: model.text(),
  email: model.text(),
  party_size: model.number(),
  /** Stamped when the „uvolnilo se místo" e-mail went out — one per entry, ever. */
  notified_at: model.dateTime().nullable(),
})
