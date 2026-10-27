import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { toAmount } from "../../../../../modules/course/pricing"
import { verifyCourseReservationToken } from "../../../../../lib/course-reservation-link"
import {
  hasOpenOnlinePayment,
  reconcileCourseReservationPayment,
} from "../../../../../lib/course-payment-reconcile"

/*
 * Rychlé potvrzení platby. Zákazník se z ComGate vrací sem (`?vysledek=paid`)
 * a stránka se ptá na stav. Dřív čekala na oznámení od ComGate (chodí jen
 * s adresou v portálu) nebo na dohledový job (až 10 minut). Teď se při čtení
 * nezaplacené online rezervace zeptáme brány hned a zaplacenou platbu
 * zachytíme — „zaplaceno" pak zapíše subscriber během vteřiny, stránka si
 * to dočte dalším obnovením.
 *
 * Nejvýš jeden dotaz na bránu za 2 s na rezervaci: stránka se po návratu
 * obnovuje sama a brána nemá dostat salvu.
 */
const CHECK_EVERY_MS = 2000
const lastCheck = new Map<string, number>()
/** Kolik počkat, než subscriber po zachycení zapíše „zaplaceno" (ms). */
const SETTLE_WAIT_MS = [300, 500, 700, 1000]

const loadReservation = async (courseService: CourseModuleService, id: string) =>
  ((await courseService.listCourseReservations(
    { id } as never,
    { relations: ["term"] } as never
  )) as any[])[0]

/**
 * One reservation, for whoever holds its signed link.
 *
 * The ComGate return pages and the confirmation e-mail both land here without
 * a session, so access is proven by the HMAC token instead. The response is
 * deliberately narrow — what the booker needs to see, not the whole row.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const reservationId = req.params.id

  if (!verifyCourseReservationToken(reservationId, req.query.token)) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }

  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  let reservation = await loadReservation(courseService, reservationId)

  if (!reservation || !reservation.term) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }

  const now = Date.now()
  if (hasOpenOnlinePayment(reservation) && now - (lastCheck.get(reservationId) ?? 0) >= CHECK_EVERY_MS) {
    lastCheck.set(reservationId, now)
    if (lastCheck.size > 500) lastCheck.clear()
    const captured = await reconcileCourseReservationPayment(req.scope as any, reservation).catch(() => false)
    for (const wait of captured ? SETTLE_WAIT_MS : []) {
      await new Promise((done) => setTimeout(done, wait))
      const fresh = await loadReservation(courseService, reservationId)
      if (fresh?.term) reservation = fresh
      if (reservation.payment_status === "paid") break
    }
  }

  res.json({
    reservation: {
      id: reservation.id,
      name: reservation.name,
      party_size: reservation.party_size,
      pricing_tier: reservation.pricing_tier,
      total_price: toAmount(reservation.total_price),
      payment_method: reservation.payment_method,
      payment_status: reservation.payment_status,
      status: reservation.status,
      /** Why a cancelled row was cancelled — the page words self-cancels differently. */
      cancel_reason: reservation.cancel_reason ?? null,
      /** Stamped once the automatic refund ran — the page may promise money truthfully. */
      refunded_at: reservation.refunded_at ?? null,
      invoice_pdf_url: reservation.idoklad_pdf_url ?? null,
      term: {
        id: reservation.term.id,
        title: reservation.term.title,
        location: reservation.term.location,
        starts_at: reservation.term.starts_at,
        duration_minutes: reservation.term.duration_minutes ?? null,
        status: reservation.term.status,
      },
    },
  })
}
