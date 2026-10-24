import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { refundCourseReservation } from "../../../../../../lib/course-refund"
import { notifyCourseWaitlist } from "../../../../../../lib/course-waitlist"
import { sendCourseReservationCancelledEmail } from "../../../../../../lib/course-emails"
import { serializeAdminReservation } from "../../../helpers"

/**
 * Rozhodnutí o žádosti zákazníka o zrušení rezervace.
 *
 * Žádost vzniká tam, kde se dřív jen odmítalo — zákazník chce zrušit později
 * než 24 h před začátkem. Storno podmínky (Matěj, 20. 10. 2026) říkají, že
 * se to posoudí individuálně; tohle je to posouzení.
 *
 * ## Tři rozhodnutí, ne dvě
 *
 * Schválit se dá **s vrácením peněz i bez něj**, a to je jádro věci: pozdní
 * zrušení nemusí znamenat plnou vratku a majitelka na to má mít páku, aniž
 * by musela odmítnout celé zrušení. Proto `refund` zvlášť od `decision`.
 *
 * - `approve` + `refund: true` → místo se uvolní a peníze jdou zpět,
 * - `approve` + `refund: false` → místo se uvolní, peníze zůstávají,
 * - `deny` → rezervace platí dál; zákazník se dozví proč.
 *
 * Co napíše do `note`, čte zákazník v e-mailu. U zamítnutí je to povinné —
 * „ne" bez důvodu je to, kvůli čemu lidé volají.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const body = (req.body ?? {}) as {
    decision?: "approve" | "deny"
    refund?: boolean
    note?: string
  }

  if (body.decision !== "approve" && body.decision !== "deny") {
    res.status(400).json({ message: "Chybí rozhodnutí (approve / deny)." })
    return
  }

  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (body.decision === "deny" && !note) {
    res.status(400).json({
      message:
        "U zamítnutí napište prosím důvod — zákazník ho uvidí v e-mailu.",
    })
    return
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
  if (reservation.cancel_request_status !== "pending") {
    res.status(400).json({
      message: "U téhle rezervace žádná žádost o zrušení nečeká.",
    })
    return
  }

  const term = reservation.term
  const now = new Date()

  /* ------------------------------------------------------------ zamítnuto */
  if (body.decision === "deny") {
    await courseService.updateCourseReservations({
      id: reservation.id,
      cancel_request_status: "denied",
      cancel_decided_at: now,
      cancel_decision_note: note,
    } as never)

    // Zamítnutí nemá vlastní šablonu: rezervace platí dál, takže zákazníkovi
    // jde potvrzení toho, co platí, s vysvětlením v poznámce. Zpráva
    // majitelky je to podstatné — proto `note` do `description`.
    logger.info(
      `[kurzy] Žádost o zrušení rezervace ${reservation.id} (${reservation.name}) zamítnuta.`
    )

    const [updated] = (await courseService.listCourseReservations(
      { id: reservation.id } as never
    )) as any[]
    res.json({
      reservation: serializeAdminReservation(updated ?? reservation),
      decision: "denied",
      // Zákazníkovi píše majitelka sama — zamítnutí je rozhovor, ne automat.
      customer_emailed: false,
    })
    return
  }

  /* ------------------------------------------------------------ schváleno */
  const paid = reservation.payment_status === "paid"
  const paidOnline = paid && reservation.payment_method === "online"
  const vratit = body.refund !== false && paidOnline

  await courseService.updateCourseReservations({
    id: reservation.id,
    status: "cancelled",
    cancelled_at: now,
    // Zrušil to zákazník; majitelka to jen schválila.
    cancel_reason: "customer",
    cancel_request_status: "approved",
    cancel_decided_at: now,
    cancel_decision_note: note || null,
  } as never)
  reservation.status = "cancelled"
  reservation.cancelled_at = now.toISOString()
  reservation.cancel_reason = "customer"

  /* `refunded_at` uvnitř hlídá, aby se nevracelo dvakrát. */
  const refund = vratit
    ? await refundCourseReservation(req.scope, reservation)
    : null
  const refunded =
    refund?.status === "refunded" || refund?.status === "already_refunded"
  if (refund?.status === "refunded") {
    reservation.refunded_at = now.toISOString()
  }

  let customerEmailed = false
  if (reservation.email) {
    customerEmailed = await sendCourseReservationCancelledEmail(
      req.scope,
      reservation,
      term,
      {
        variant: !paid ? "unpaid" : refunded ? "refunded" : "manual_refund",
      }
    ).catch((error) => {
      logger.error(
        `[kurzy] E-mail o zrušení rezervace ${reservation.id} se nepodařilo odeslat: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
      return false
    })
  }

  /* Uvolněné místo probudí čekací listinu — stejně jako u každého zrušení. */
  await notifyCourseWaitlist(req.scope, term.id).catch(() => undefined)

  logger.info(
    `[kurzy] Žádost o zrušení rezervace ${reservation.id} (${reservation.name}) schválena${
      vratit ? refunded ? " s vrácením peněz" : " — vrácení peněz se nepovedlo" : " bez vrácení peněz"
    }.`
  )

  const [updated] = (await courseService.listCourseReservations(
    { id: reservation.id } as never
  )) as any[]

  res.json({
    reservation: serializeAdminReservation(updated ?? reservation),
    decision: "approved",
    refund: {
      attempted: Boolean(vratit),
      refunded,
      amount: refunded ? Number(reservation.total_price) : null,
    },
    /** Zaplaceno, ale vrácení nešlo automaticky → peníze zpět ručně. */
    needs_manual_refund: paid && vratit && !refunded,
    customer_emailed: customerEmailed,
  })
}
