import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { isValidBatchKey } from "../../../../../../lib/course-attendance"
import { sendCourseMessage } from "../../../../../../lib/course-message"

/**
 * „Napsat všem účastníkům" — e-mail každé platné rezervaci termínu.
 *
 * `idempotency_key` vymyslí okno v adminu při otevření; opakovaný požadavek
 * se stejným klíčem nic nepošle podruhé (klíč notifikace na každého
 * účastníka). Zrušený termín nemá komu psát — odmítne se.
 */

const MessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Napište text zprávy.")
    .max(4000, "Zpráva je moc dlouhá — zkraťte ji prosím."),
  subject: z.string().trim().max(150, "Předmět je moc dlouhý.").nullable().optional(),
  idempotency_key: z.string().refine(isValidBatchKey, "Obnovte prosím stránku a zkuste to znovu."),
})

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = MessageSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({
      message:
        parsed.error.issues[0]?.message ?? "Zkontrolujte prosím text zprávy.",
    })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const [term] = (await courseService.listCourseTerms(
    { id: req.params.id } as never,
    { relations: ["reservations"] } as never
  )) as any[]
  if (!term) {
    res.status(404).json({ message: "Termín nebyl nalezen." })
    return
  }
  if (term.status === "cancelled") {
    res.status(400).json({ message: "Termín je zrušený — zprávu už není komu poslat." })
    return
  }

  const result = await sendCourseMessage(req.scope, term, {
    message: parsed.data.message,
    subject: parsed.data.subject ?? null,
    batchKey: parsed.data.idempotency_key,
  })

  res.json(result)
}
