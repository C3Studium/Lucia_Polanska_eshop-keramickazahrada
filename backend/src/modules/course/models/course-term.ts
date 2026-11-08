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
 *
 * Od 8. 11. 2026 k tomu dvě věci, o které si řekla majitelka:
 *
 * - volume_pricing_enabled — vypínač množstevní slevy. U veřejných kurzů ji
 *   nechce vůbec: platí se za osobu, ať přijde kdokoli. Mazat kvůli tomu ceny
 *   za dva a za skupinu by znamenalo napsat je znovu, až je zase zapne, takže
 *   se jen přestanou používat. Nevyplněné = zapnuto, aby se starým termínům
 *   nezměnila cena pod rukama.
 * - price_child a child_max_age — děti mají slevu (dospělák 500, děti 430 za
 *   lekci). Je to cena za osobu vedle té dospělé, ne procento: tak to
 *   majitelka počítá a tak to i řekne zákazníkovi.
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
  /* Vypínač množstevní slevy — viz hlavička. Nevyplněné znamená zapnuto. */
  volume_pricing_enabled: model.boolean().default(true),
  /* Cena za dítě a do kolika let se za dítě počítá. */
  price_child: model.bigNumber().nullable(),
  child_max_age: model.number().nullable(),
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
