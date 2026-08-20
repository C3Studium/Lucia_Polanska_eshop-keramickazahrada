import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { seatsTaken, toAmount } from "../../../../../modules/course/pricing"
import { notifyCourseWaitlist } from "../../../../../lib/course-waitlist"
import { serializeAdminTerm } from "../../helpers"
import { PatchCourseTermSchema } from "../route"

const loadTerm = async (
  req: AuthenticatedMedusaRequest
): Promise<any | null> => {
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const terms = (await courseService.listCourseTerms(
    { id: req.params.id } as never,
    { relations: ["reservations", "waitlist"] } as never
  )) as any[]
  return terms[0] ?? null
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const term = await loadTerm(req)
  if (!term) {
    res.status(404).json({ message: "Termín nebyl nalezen." })
    return
  }
  res.json({ term: serializeAdminTerm(term) })
}

export async function PATCH(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = PatchCourseTermSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message ?? "Zkontrolujte prosím vyplněné údaje.",
    })
    return
  }

  const term = await loadTerm(req)
  if (!term) {
    res.status(404).json({ message: "Termín nebyl nalezen." })
    return
  }
  if (term.status === "cancelled") {
    res.status(400).json({ message: "Zrušený termín už nelze upravovat." })
    return
  }

  const input = parsed.data

  // A capacity below what is already booked would mean silent overbooking.
  if (input.capacity !== undefined) {
    const taken = seatsTaken(term.reservations ?? [])
    if (input.capacity < taken) {
      res.status(400).json({
        message: `Kapacitu nelze snížit pod počet už rezervovaných míst (${taken}).`,
      })
      return
    }
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  await courseService.updateCourseTerms({
    id: term.id,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.starts_at !== undefined
      ? { starts_at: new Date(input.starts_at) }
      : {}),
    ...(input.duration_minutes !== undefined
      ? { duration_minutes: input.duration_minutes }
      : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.price_single !== undefined
      ? { price_single: input.price_single }
      : {}),
    ...(input.price_two !== undefined ? { price_two: input.price_two } : {}),
    ...(input.group_min !== undefined ? { group_min: input.group_min } : {}),
    ...(input.price_group_per_person !== undefined
      ? { price_group_per_person: input.price_group_per_person }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.note !== undefined ? { note: input.note || null } : {}),
  } as never)

  // A raised capacity frees seats exactly like a cancellation does — the
  // waitlist hears about it the same way. (The hook itself re-checks that
  // the term is published and in the future, so a capacity bump on a draft
  // stays quiet.) Best-effort: a failed notification never fails the save.
  const capacityGrew =
    input.capacity !== undefined &&
    input.capacity > Math.trunc(toAmount(term.capacity))
  if (capacityGrew) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    await notifyCourseWaitlist(req.scope, term.id).catch((error) =>
      logger.error(
        `[kurzy] Upozornění čekatelů po navýšení kapacity termínu ${term.id} selhalo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    )
  }

  const updated = await loadTerm(req)
  res.json({ term: serializeAdminTerm(updated) })
}
