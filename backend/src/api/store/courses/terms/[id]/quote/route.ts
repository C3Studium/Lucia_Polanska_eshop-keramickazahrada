import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import {
  quoteFor,
  seatsLeft,
} from "../../../../../../modules/course/pricing"

/**
 * The server-computed price for `party_size` people on one term.
 *
 * The reservation form calls this as the customer moves the „počet osob"
 * stepper, so the number on screen is always the server's number — the same
 * `quoteFor` the create runs again inside its row lock. Nothing from this
 * response is ever trusted back.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const partySize = Math.trunc(Number(req.query.party_size))
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    res.status(400).json({ message: "Počet osob musí být alespoň 1." })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const terms = (await courseService.listCourseTerms(
    { id: req.params.id, status: "published" } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  const term = terms[0]

  if (!term || new Date(term.starts_at).getTime() <= Date.now()) {
    res.status(404).json({ message: "Termín kurzu nebyl nalezen." })
    return
  }

  /* Děti z dotazu — ořezání na počet osob dělá `quoteFor`, ať to pravidlo
     existuje jen jednou. Nečíslo znamená nula, ne chybu: starší obchod
     tenhle parametr neposílá vůbec. */
  const children = Math.trunc(Number(req.query.children))
  const quote = quoteFor(
    { people: partySize, children: Number.isFinite(children) ? children : 0 },
    term
  )
  res.json({
    term_id: term.id,
    party_size: partySize,
    children: quote.children,
    tier: quote.tier,
    per_person: quote.per_person,
    child_per_person: quote.child_per_person,
    total: quote.total,
    seats_left: seatsLeft(term.capacity, term.reservations ?? []),
  })
}
