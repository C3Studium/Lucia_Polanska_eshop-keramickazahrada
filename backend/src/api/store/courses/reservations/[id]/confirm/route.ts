import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { photoConsentLine } from "../../../../../../modules/course/legal"
import { verifyCourseReservationToken } from "../../../../../../lib/course-reservation-link"
import { ensureCoursePaymentLink } from "../../../../../../lib/course-payment"
import { formatCourseDate, sendCourseReservationConfirmedEmail } from "../../../../../../lib/course-emails"
import { syncCourseMoney } from "../../../../../../lib/course-money"
import { notifyMerchant } from "../../../../../../lib/notify"
import { buildReservationConsents } from "../../schema"

/**
 * POST /store/courses/reservations/:id/confirm?token=… — potvrzení schválené
 * výjimky (žádost o místo na plném termínu, lib/course-request).
 *
 * Zákazník v rezervaci vybere platbu a potvrdí obchodní podmínky (stejné
 * souhlasy jako běžná rezervace — schválená žádost je ještě neměla):
 * - `online` → vrátí `payment_url` na ComGate (dál jako běžná online platba),
 * - `on_site` → rezervace se potvrdí hned, platí se na místě.
 */
const Body = z.object({
  payment_method: z.enum(["online", "on_site"]),
  terms_accepted: z.literal(true, { error: "Potvrďte prosím souhlas s obchodními podmínkami." }),
  exception_ack: z.literal(true).optional(),
  photo_consent: z.boolean().optional(),
  terms_version: z.string().trim().max(40).optional(),
  client_accepted_at: z.string().trim().max(40).optional(),
  cancellation_terms_text_version: z.string().trim().max(200).optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const reservationId = req.params.id
  if (!verifyCourseReservationToken(reservationId, req.query.token)) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  const parsed = Body.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Zkontrolujte prosím volbu platby." })
    return
  }
  const input = parsed.data
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const [reservation] = (await courseService.listCourseReservations(
    { id: reservationId } as never,
    { relations: ["term"] } as never
  )) as any[]

  if (!reservation?.term) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }
  if (reservation.status !== "active") {
    res.status(400).json({ message: "Tahle rezervace už neplatí." })
    return
  }
  if (!reservation.payment_choice_pending) {
    res.status(400).json({ message: "Rezervace je už potvrzená." })
    return
  }
  const term = reservation.term
  if (term.status !== "published" || new Date(term.starts_at).getTime() <= Date.now()) {
    res.status(400).json({ message: "Tento termín už není v nabídce." })
    return
  }

  const consents = buildReservationConsents({
    ...input,
    exception_ack: true,
  } as never)

  if (input.payment_method === "on_site") {
    const updated = await courseService.updateCourseReservations({
      id: reservation.id,
      payment_method: "on_site",
      payment_status: "on_site",
      payment_choice_pending: false,
      consents,
    } as never)
    await syncCourseMoney(req.scope, reservation.id).catch(() => null)
    await sendCourseReservationConfirmedEmail(req.scope, { ...updated, consents }, term, { variant: "on_site" }).catch(
      () => undefined
    )
    await notifyMerchant(req.scope, {
      key: `course-request-confirmed:${reservation.id}`,
      title: `Kurzy: výjimka potvrzena — ${reservation.name}`,
      description: [
        `${term.title} · ${formatCourseDate(term.starts_at)}`,
        `${reservation.party_size} os. · ${reservation.name}${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
        "Zaplatí na místě.",
        photoConsentLine(consents),
      ].join(String.fromCharCode(10)),
      audience: "owner",
    }).catch(() => undefined)
    res.json({ ok: true, payment_method: "on_site" })
    return
  }

  await courseService.updateCourseReservations({
    id: reservation.id,
    payment_choice_pending: false,
    consents,
  } as never)
  try {
    const link = await ensureCoursePaymentLink(req.scope, { reservation: { ...reservation, consents }, term })
    res.json({ ok: true, payment_method: "online", payment_url: link.payment_url })
  } catch (error) {
    // Platba se nezaložila → zákazník musí mít možnost vybrat znovu.
    await courseService
      .updateCourseReservations({ id: reservation.id, payment_choice_pending: true } as never)
      .catch(() => undefined)
    if (error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA) {
      res.status(400).json({ message: error.message })
      return
    }
    res.status(502).json({ message: "Platbu se teď nepodařilo založit. Zkuste to prosím znovu, nebo zvolte platbu na místě." })
  }
}
