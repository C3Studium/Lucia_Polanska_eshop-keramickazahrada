import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { serializeAdminReservation } from "../../../helpers"

/**
 * Manual reservation entry — „zavolala paní Nováková, přijdou 3".
 *
 * Just a name, a head count and an optional note; e-mail and phone only if
 * the owner has them. Goes through the same `reserveSeats` as the web, so the
 * capacity lock and the server-side price hold for phone bookings too.
 * Payment is on site by definition — anyone wanting to pay by card books on
 * the web.
 */

const ManualReservationSchema = z.object({
  name: z.string().trim().min(2, "Vyplňte jméno.").max(200),
  party_size: z.number().int().min(1).max(30),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = ManualReservationSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message ?? "Zkontrolujte prosím vyplněné údaje.",
    })
    return
  }

  const input = parsed.data
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  try {
    const { reservation } = await courseService.reserveSeats({
      term_id: req.params.id,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      party_size: input.party_size,
      payment_method: "on_site",
      source: "manual",
      note: input.note || null,
    })
    res.status(201).json({ reservation: serializeAdminReservation(reservation) })
  } catch (error) {
    if (error instanceof MedusaError) {
      res
        .status(error.type === MedusaError.Types.NOT_FOUND ? 404 : 400)
        .json({ message: error.message })
      return
    }
    throw error
  }
}
