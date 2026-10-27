import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { toAmount } from "../modules/course/pricing"
import { paymentStatusFromProvider } from "./payment-provider-status"

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

/** @returns `true`, když brána hlásí zaplaceno a platba se právě zachytila. */
export const reconcileCourseReservationPayment = async (
  container: MedusaContainer,
  reservation: any
): Promise<boolean> => (await checkCourseReservationPayment(container, reservation)).captured
