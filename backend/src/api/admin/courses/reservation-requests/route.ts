import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../modules/course"
import type CourseModuleService from "../../../../modules/course/service"
import { toAmount } from "../../../../modules/course/pricing"
import { serializeAdminTerm } from "../helpers"

/**
 * GET /admin/courses/reservation-requests?stav=cekajici|vse
 *
 * Žádosti o místo na plně obsazeném termínu (lib/course-request). Majitelka
 * je vyřizuje v administraci (Kurzy → Žádosti o místo): zavolat, schválit
 * výjimku, nebo zamítnout. Nejdéle čekající nahoře.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const vse = String(req.query.stav ?? "cekajici") === "vse"
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const entries = (await courseService.listCourseWaitlists(
    (vse ? {} : { status: "waiting" }) as never,
    { relations: ["term", "term.reservations"] } as never
  )) as any[]

  const rows = entries
    .filter((entry) => entry.term)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      phone: entry.phone ?? null,
      party_size: Math.trunc(toAmount(entry.party_size)),
      note: entry.note ?? null,
      status: entry.status ?? "waiting",
      decided_at: entry.decided_at ?? null,
      decision_note: entry.decision_note ?? null,
      reservation_id: entry.reservation_id ?? null,
      notified_at: entry.notified_at ?? null,
      created_at: entry.created_at,
      term: serializeAdminTerm({ ...entry.term, waitlist: [] }),
    }))

  res.setHeader("Cache-Control", "no-store")
  res.json({ requests: rows, pending_count: rows.filter((row) => row.status === "waiting").length })
}
