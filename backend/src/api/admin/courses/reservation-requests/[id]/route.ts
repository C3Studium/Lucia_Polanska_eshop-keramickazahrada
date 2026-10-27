import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { approveCourseRequest, denyCourseRequest } from "../../../../../lib/course-request"
import { syncCourseMoney } from "../../../../../lib/course-money"

/**
 * POST /admin/courses/reservation-requests/:id — rozhodnutí o žádosti o místo.
 *
 * `approve` = výjimka nad kapacitu: vznikne rezervace a zákazníkovi přijde
 * e-mail s odkazem, kde si vybere platbu. `deny` = omluvný e-mail. `note` jde
 * zákazníkovi do e-mailu.
 */
const Body = z.object({
  action: z.enum(["approve", "deny"]),
  note: z.string().trim().max(2000).optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = Body.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Neplatné rozhodnutí." })
    return
  }
  try {
    if (parsed.data.action === "approve") {
      const { entry, reservation } = await approveCourseRequest(req.scope, req.params.id, parsed.data.note)
      await syncCourseMoney(req.scope, reservation.id).catch(() => null)
      res.json({ request: entry, reservation_id: reservation.id })
      return
    }
    const { entry } = await denyCourseRequest(req.scope, req.params.id, parsed.data.note)
    res.json({ request: entry })
  } catch (error) {
    if (error instanceof MedusaError) {
      res.status(error.type === MedusaError.Types.NOT_FOUND ? 404 : 400).json({ message: error.message })
      return
    }
    throw error
  }
}
