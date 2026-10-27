import { model } from "@medusajs/framework/utils"
import { CourseTerm } from "./course-term"

/**
 * Žádost o místo na plně obsazeném termínu (dřív jen „čekací listina").
 *
 * Od 28. 10. 2026 je to žádost, o které rozhoduje majitelka: může udělat
 * výjimku nad kapacitu (`approved` → vznikne rezervace, zákazník si v ní vybere
 * platbu), nebo ji zamítnout (`denied` → omluvný e-mail). Telefon je tu proto,
 * aby mohla zavolat. `waiting` zůstává i původní význam: když se místo uvolní,
 * přijde „uvolnilo se místo" (`notified_at`, jednou za záznam).
 */
export const CourseWaitlist = model.define("course_waitlist", {
  id: model.id().primaryKey(),
  term: model.belongsTo(() => CourseTerm, {
    mappedBy: "waitlist",
  }),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  party_size: model.number(),
  /** Vzkaz zákazníka k žádosti („jsme rodina, děti 8 a 10 let"). */
  note: model.text().nullable(),
  status: model.enum(["waiting", "approved", "denied"]).index().default("waiting"),
  decided_at: model.dateTime().nullable(),
  /** Co majitelka k rozhodnutí napsala; jde zákazníkovi v e-mailu. */
  decision_note: model.text().nullable(),
  /** Rezervace, která vznikla schválením. */
  reservation_id: model.text().nullable(),
  /** Stamped when the „uvolnilo se místo" e-mail went out — one per entry, ever. */
  notified_at: model.dateTime().nullable(),
})
