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
 * @returns `true`, když brána hlásí zaplaceno a platba se právě zachytila.
 * Vyhazuje jen chyby brány / workflow — volající rozhodne, co s nimi.
 */
export const reconcileCourseReservationPayment = async (
  container: MedusaContainer,
  reservation: any
): Promise<boolean> => {
  if (!hasOpenOnlinePayment(reservation)) return false

  const paymentModule = container.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({
    id: reservation.payment_session_id,
  } as never)
  if (!session) return false

  // Ptá se poskytovatele, neodhaduje ze stáří záznamu.
  const result = await paymentStatusFromProvider(container, session as any)
  const status = String(result?.status ?? "").toLowerCase()
  if (!HOTOVO.includes(status)) return false

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
  return true
}
