import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../modules/course"
import type CourseModuleService from "../../../../modules/course/service"
import { serializeAdminReservation, serializeAdminTerm } from "../helpers"

/**
 * Fronta žádostí o zrušení rezervace kurzu.
 *
 * Žádost vzniká tam, kde se dřív jen odmítalo: zákazník chce zrušit později
 * než 24 h před začátkem (`api/store/courses/reservations/[id]/cancel`).
 * Tahle routa je to, co majitelka v administraci vidí.
 *
 * `?stav=cekajici` (výchozí) vrací jen to, co čeká na rozhodnutí; `vse`
 * přidá i vyřízené, aby šlo dohledat, jak se co dopadlo.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const vse = String(req.query.stav ?? "cekajici") === "vse"
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const reservations = (await courseService.listCourseReservations(
    (vse
      ? { cancel_request_status: ["pending", "approved", "denied"] }
      : { cancel_request_status: "pending" }) as never,
    { relations: ["term"] } as never
  )) as any[]

  /* Nejdéle čekající nahoře — fronta se vyřizuje odshora. */
  const rows = reservations
    .filter((reservation) => reservation.term)
    .sort(
      (a, b) =>
        new Date(a.cancel_requested_at ?? 0).getTime() -
        new Date(b.cancel_requested_at ?? 0).getTime()
    )
    .map((reservation) => ({
      ...serializeAdminReservation(reservation),
      term: serializeAdminTerm({ ...reservation.term, reservations: [], waitlist: [] }),
    }))

  res.json({
    requests: rows,
    pending_count: rows.filter((row) => row.cancel_request_status === "pending")
      .length,
  })
}
