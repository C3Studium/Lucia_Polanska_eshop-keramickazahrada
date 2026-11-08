import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../modules/course"
import type CourseModuleService from "../../../../modules/course/service"
import {
  childMaxAge,
  hasChildPricing,
  seatsLeft,
  seatsTaken,
  toAmount,
  volumePricingOn,
} from "../../../../modules/course/pricing"

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
      /*
       * Vypnutá množstevní sleva se MASKUJE UŽ TADY (8. 11. 2026).
       *
       * Ceny za dva a za skupinu zůstávají v databázi — majitelka je nemaže,
       * jen je u veřejných kurzů nenabízí. Kdyby je tahle routa poslala dál,
       * musel by vypínač znovu respektovat každý, kdo je vykresluje: okno
       * rezervace, upoutávka na stránce kurzů i e-maily. Jedno z nich by se
       * zapomnělo. Takhle se o tom nikdo jiný nemusí dozvědět: co se nenabízí,
       * to obchod nedostane. Výpočet ceny drží totéž pravidlo ve
       * `modules/course/pricing.ts`.
       */
      const mnozstevni = volumePricingOn(term)
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
        price_two:
          mnozstevni && term.price_two != null ? toAmount(term.price_two) : null,
        group_min:
          mnozstevni && term.group_min != null
            ? Math.trunc(toAmount(term.group_min))
            : null,
        price_group_per_person:
          mnozstevni && term.price_group_per_person != null
            ? toAmount(term.price_group_per_person)
            : null,
        /* Dětská cena a hranice věku — obchod z nich skládá druhé počítadlo. */
        price_child: hasChildPricing(term) ? toAmount(term.price_child) : null,
        child_max_age: hasChildPricing(term) ? childMaxAge(term) : null,
      }
    }),
  })
}
