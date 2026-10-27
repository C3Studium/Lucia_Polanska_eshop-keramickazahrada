import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { toAmount } from "../modules/course/pricing"
import { paymentStatusFromProvider } from "./payment-provider-status"
import { COURSE_MODULE } from "../modules/course"
import { sendCoursePaymentFailedEmail } from "./course-emails"

/**
 * Srovnání platby jedné rezervace kurzu s bránou.
 *
 * Totéž, co dělá ověřené oznámení od ComGate: zeptá se brány na stav a když je
 * zaplaceno, pustí `processPaymentWorkflow` (captured). „Zaplaceno", fakturu
 * a e-maily pak obstará idempotentní `subscribers/course-payment.ts` — dvojí
 * srovnání (oznámení + tohle) nic nezdvojí.
 *
 * Volají to dva:
 * - `jobs/reconcile-course-payments.ts` každých deset minut (záchrana, když
 *   oznámení nechodí),
 * - `GET /store/courses/reservations/:id` hned po návratu zákazníka z brány —
 *   to je ta rychlá cesta: zákazník nečeká na oznámení ani na job.
 */

/** Terminální stavy brány — tam už není co hlídat. */
const HOTOVO = ["captured", "authorized"]

/** Online platba, která u nás ještě není zaplacená, u živé rezervace s relací. */
export const hasOpenOnlinePayment = (reservation: any): boolean =>
  Boolean(
    reservation &&
      reservation.payment_method === "online" &&
      reservation.payment_status !== "paid" &&
      reservation.status !== "cancelled" &&
      reservation.payment_session_id
  )

/**
 * Živý stav platby u brány (`captured` / `canceled` / `pending` / …), nebo
 * null, když se není na co ptát. Neukládá nic — jen se zeptá.
 *
 * Bez oznámení od ComGate (adresa v portálu) je to jediný způsob, jak poznat,
 * že zákazník na bráně klikl „Zrušit platbu" (`canceled`), nebo jen
 * „Návrat do e-shopu" (platba zůstává `pending`).
 */
export const courseGatewayStatus = async (
  container: MedusaContainer,
  reservation: any
): Promise<string | null> => {
  if (!reservation?.payment_session_id) return null
  const paymentModule = container.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({
    id: reservation.payment_session_id,
  } as never)
  if (!session) return null
  // Ptá se poskytovatele, neodhaduje ze stáří záznamu.
  const result = await paymentStatusFromProvider(container, session as any)
  return String(result?.status ?? "").toLowerCase() || null
}

/**
 * Zeptá se brány a zaplacenou platbu zachytí.
 * @returns `captured` = právě se zachytila; `status` = živý stav u brány.
 * Vyhazuje jen chyby brány / workflow — volající rozhodne, co s nimi.
 */
export const checkCourseReservationPayment = async (
  container: MedusaContainer,
  reservation: any
): Promise<{ captured: boolean; status: string | null }> => {
  if (!hasOpenOnlinePayment(reservation)) return { captured: false, status: null }
  const status = await courseGatewayStatus(container, reservation)
  if (status === "canceled") {
    /*
     * Zákazník klikl „Zrušit platbu", banka platbu zamítla, nebo vypršela.
     * Rezervace trvá (místo se drží 24 h) — pošleme odkaz, jak zaplatit znovu.
     * Jednou za platební pokus (dedupe), takže opakované kontroly nic nezdvojí.
     */
    await notifyPaymentFailed(container, reservation)
    return { captured: false, status }
  }
  if (!status || !HOTOVO.includes(status)) return { captured: false, status }

  /*
   * Relace byla jen vytvořená, ne autorizovaná, takže v kolekci není žádná
   * `Payment` k zachycení — `processPaymentWorkflow` s `captured` ji
   * autorizuje A zachytí, což je přesně to, co dělá ověřené oznámení.
   * Teprve to vydá `payment.captured`.
   */
  await processPaymentWorkflow(container).run({
    input: {
      action: "captured",
      data: {
        session_id: reservation.payment_session_id,
        amount: toAmount(reservation.total_price),
      },
    } as never,
  })
  return { captured: true, status }
}

const notifyPaymentFailed = async (container: MedusaContainer, reservation: any) => {
  try {
    let term = reservation.term
    if (!term) {
      const courseService = container.resolve(COURSE_MODULE) as any
      const [withTerm] = await courseService.listCourseReservations(
        { id: reservation.id },
        { relations: ["term"] }
      )
      term = withTerm?.term
    }
    if (!term) return
    // Termín, který už proběhl nebo se zrušil, nemá smysl znovu platit.
    if (term.status !== "published" || new Date(term.starts_at).getTime() <= Date.now()) return
    await sendCoursePaymentFailedEmail(container, reservation, term)
  } catch {
    // E-mail nesmí shodit kontrolu platby — opakuje se při další kontrole.
  }
}

/** @returns `true`, když brána hlásí zaplaceno a platba se právě zachytila. */
export const reconcileCourseReservationPayment = async (
  container: MedusaContainer,
  reservation: any
): Promise<boolean> => (await checkCourseReservationPayment(container, reservation)).captured

/** Zaplacená rezervace, ale po úpravě počtu osob zbývá doplatek. */
export const hasOpenSupplement = (reservation: any): boolean =>
  Boolean(
    reservation &&
      reservation.payment_method === "online" &&
      reservation.payment_status === "paid" &&
      reservation.status !== "cancelled" &&
      toAmount(reservation.amount_due) > 0
  )

/**
 * Doplatky čekající na platbu (`course_payment_request`): zaplacený u brány
 * zachytí (→ subscriber: zaplaceno, přepočet, e-mail), zrušený u brány označí
 * jako zrušený (další „Doplatit" založí nový). Vrací, zda se něco zachytilo.
 */
export const checkCourseSupplementPayments = async (
  container: MedusaContainer,
  reservationId: string
): Promise<boolean> => {
  const courseService = container.resolve(COURSE_MODULE) as any
  const pending = ((await courseService.listCoursePaymentRequests({
    reservation_id: reservationId,
    type: "supplement",
    status: "pending",
  })) as any[]).filter((r) => r.payment_session_id)
  let captured = false
  for (const request of pending) {
    const status = await courseGatewayStatus(container, request)
    if (status === "canceled") {
      await courseService.updateCoursePaymentRequests({ id: request.id, status: "cancelled", note: "Zrušeno na platební bráně." })
      continue
    }
    if (!status || !HOTOVO.includes(status)) continue
    await processPaymentWorkflow(container).run({
      input: {
        action: "captured",
        data: { session_id: request.payment_session_id, amount: toAmount(request.amount) },
      } as never,
    })
    captured = true
  }
  return captured
}
