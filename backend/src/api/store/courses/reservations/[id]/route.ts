import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COURSE_MODULE } from "../../../../../modules/course"
import type CourseModuleService from "../../../../../modules/course/service"
import { toAmount } from "../../../../../modules/course/pricing"
import { verifyCourseReservationToken } from "../../../../../lib/course-reservation-link"
import {
  checkCourseReservationPayment,
  checkCourseSupplementPayments,
  hasOpenOnlinePayment,
  hasOpenSupplement,
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
const lastCheck = new Map<string, { at: number; status: string | null }>()
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

  /*
   * Živý stav u brány jde i stránce: `canceled` = zákazník klikl „Zrušit
   * platbu", `pending` po návratu = „Návrat do e-shopu" (nebo převod na
   * cestě). Stránka podle toho nabídne zaplatit znovu.
   */
  let gatewayStatus: string | null = null
  const now = Date.now()
  const previous = lastCheck.get(reservationId)
  if (hasOpenSupplement(reservation) && !(previous && now - previous.at < CHECK_EVERY_MS)) {
    lastCheck.set(reservationId, { at: now, status: null })
    const captured = await checkCourseSupplementPayments(req.scope as any, reservationId).catch(() => false)
    for (const wait of captured ? SETTLE_WAIT_MS : []) {
      await new Promise((done) => setTimeout(done, wait))
      const fresh = await loadReservation(courseService, reservationId)
      if (fresh?.term) reservation = fresh
      if (!hasOpenSupplement(reservation)) break
    }
  } else if (hasOpenOnlinePayment(reservation) && previous && now - previous.at < CHECK_EVERY_MS) {
    gatewayStatus = previous.status
  } else if (hasOpenOnlinePayment(reservation)) {
    if (lastCheck.size > 500) lastCheck.clear()
    const checked = await checkCourseReservationPayment(req.scope as any, reservation).catch(() => ({
      captured: false,
      status: null,
    }))
    gatewayStatus = checked.status
    lastCheck.set(reservationId, { at: now, status: gatewayStatus })
    for (const wait of checked.captured ? SETTLE_WAIT_MS : []) {
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
      /** Schválená výjimka (žádost o místo) — zákazník si ještě vybírá platbu. */
      payment_choice_pending: Boolean(reservation.payment_choice_pending),
      /** Evidence peněz: zaplaceno celkem a zbývá (doplatek po úpravě / na místě). */
      paid_amount: toAmount(reservation.paid_amount),
      amount_due: toAmount(reservation.amount_due),
      /** Živý stav platby u ComGate (`canceled`, `pending`, …) — jen u otevřené online platby. */
      gateway_status: reservation.payment_status === "paid" ? null : gatewayStatus,
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
