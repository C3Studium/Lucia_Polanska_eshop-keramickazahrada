import { syncCourseMoney } from "../../../../../lib/course-money"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { formatCourseDate, sendCourseReservationConfirmedEmail } from "../../../../../lib/course-emails"
import { serializeAdminReservation } from "../../helpers"

/**
 * Úpravy jedné rezervace z administrace — zatím dvě: peníze a poznámka.
 *
 * ## Proč „zaplaceno na místě" potřebovalo endpoint
 *
 * Platba kartou se zapíše sama (ověřené oznámení od ComGate → `payment.captured`
 * → `subscribers/course-payment.ts`). Platba na místě takovou chvíli nemá:
 * peníze přijdou u dveří a v systému o nich do téhle chvíle nebyl žádný záznam.
 * Administrace uměla jen zobrazit štítek „Zaplatí na místě" — a protože se
 * rezervace nikdy nestala `paid`, nešlo k ní ani vystavit fakturu.
 *
 * ## Co se tím NEDĚLÁ
 *
 * Nevybírá to peníze. Je to zápis toho, co se stalo u dveří, a jediný, kdo to
 * ví, je člověk, který je převzal. Proto to nemá žádnou automatiku a proto se
 * to dá vzít zpět (`payment_status: "pending"`) — překlik se musí dát opravit.
 *
 * Doklad se vystavuje zvlášť tlačítkem „Vystavit fakturu" (`./invoice`).
 * Dva kroky schválně: zapsat peníze a vystavit doklad jsou dvě rozhodnutí,
 * a účetně je lepší, když druhé udělá člověk vědomě.
 */
export async function PATCH(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const body = (req.body ?? {}) as {
    payment_status?: "paid" | "pending"
    note?: string | null
    /** Poslat zákazníkovi potvrzení o zaplacení (jen při přechodu na „paid"). */
    notify?: boolean
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const [reservation] = (await courseService.listCourseReservations(
    { id: req.params.id } as never,
    { relations: ["term"] } as never
  )) as any[]

  if (!reservation || !reservation.term) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }

  if (reservation.status === "cancelled") {
    res.status(400).json({
      message: "Zrušená rezervace se nedá upravovat.",
    })
    return
  }

  const patch: Record<string, unknown> = { id: reservation.id }
  let becamePaid = false

  if (body.payment_status === "paid" && reservation.payment_status !== "paid") {
    patch.payment_status = "paid"
    patch.paid_at = new Date()
    becamePaid = true
  }

  if (body.payment_status === "pending" && reservation.payment_status === "paid") {
    /*
     * Zpětvzetí překliku. U platby kartou by to byla lež — peníze u brány
     * opravdu jsou — takže se to pustí jen tam, kde zápis udělal člověk.
     */
    if (reservation.payment_method === "online") {
      res.status(400).json({
        message:
          "U platby kartou se zaplaceno odznačit nedá — peníze dorazily přes platební bránu. Pokud je chcete vrátit, zrušte rezervaci.",
      })
      return
    }
    patch.payment_status = "pending"
    patch.paid_at = null
  }

  if (body.note !== undefined) {
    patch.note = body.note?.trim() ? body.note.trim() : null
  }

  if (Object.keys(patch).length === 1) {
    // Nic ke změně — vrátí se, co je, místo prázdného zápisu.
    // Evidence peněz (zaplaceno / zbývá) po změně — lib/course-money.
    await syncCourseMoney(req.scope, req.params.id).catch(() => null)
    res.json({ reservation: serializeAdminReservation(reservation) })
    return
  }

  await courseService.updateCourseReservations(patch as never)

  /*
   * Potvrzení zákazníkovi je nabídka, ne automatika: u platby na místě často
   * stojí ten člověk přímo před ní a e-mail je mu k ničemu. Posílá se, jen
   * když se o to řekne.
   */
  let emailSent = false
  if (becamePaid && body.notify && reservation.email) {
    emailSent = await sendCourseReservationConfirmedEmail(
      req.scope,
      { ...reservation, payment_status: "paid", paid_at: patch.paid_at },
      reservation.term,
      {
        variant: "paid",
        invoicePdfUrl: reservation.idoklad_pdf_url ?? null,
        keyOverride: `course-paid-onsite:${reservation.id}`,
      }
    ).catch((error) => {
      logger.error(
        `[kurzy] Potvrzení o zaplacení (${reservation.id}) se nepodařilo odeslat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
      return false
    })
  }

  if (becamePaid) {
    logger.info(
      `[kurzy] Rezervace ${reservation.id} (${reservation.name}, ${formatCourseDate(
        reservation.term.starts_at
      )}) označena jako zaplacená na místě.`
    )
  }

  const [updated] = (await courseService.listCourseReservations(
    { id: reservation.id } as never,
    { relations: ["term"] } as never
  )) as any[]

  // Evidence peněz (zaplaceno / zbývá) po změně — lib/course-money.
  await syncCourseMoney(req.scope, req.params.id).catch(() => null)
  res.json({
    reservation: serializeAdminReservation(updated ?? reservation),
    email_sent: emailSent,
  })
}
