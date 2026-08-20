import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { toAmount } from "../modules/course/pricing"
import { COMGATE_PROVIDER_ID, paymentUrlFromSession } from "./balance-payment"
import { courseReservationPath } from "./course-reservation-link"

/**
 * A ComGate payment link for a course reservation.
 *
 * ## Why a *standalone* payment collection, not a signed cart-less GET
 *
 * The spec offered two doors and this codebase genuinely supports only one of
 * them end to end. The made-to-order balance flow proves the pattern: a
 * payment **collection** + `createPaymentSessionsWorkflow` with the ComGate
 * provider, whose verified push notification then flows through the existing
 * `/hooks/payment/pp_comgate_comgate` route → `processPaymentWorkflow` →
 * `payment.captured`. That webhook route only trusts `refId`s that are Medusa
 * payment-session ids (`payses_…`), so any payment created *outside* a payment
 * session would be rejected by our own webhook. The only difference from the
 * balance flow is that a reservation has no order, and the payment module is
 * perfectly happy to create a collection without one — the order link is a
 * separate module link the balance flow adds and we simply don't.
 *
 * Reuse rules mirror `ensureBalancePaymentLink`: a reservation that already
 * has a stored link gets the same link back (an impatient double-click or a
 * retry lands on one payment, not two).
 */
export const ensureCoursePaymentLink = async (
  container: MedusaContainer,
  { reservation, term }: { reservation: any; term: any }
): Promise<{ payment_url: string; reused: boolean }> => {
  if (reservation.payment_status === "paid") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Tato rezervace je již zaplacená."
    )
  }
  if (reservation.status === "cancelled") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Tato rezervace byla zrušena."
    )
  }

  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const paymentModule = container.resolve(Modules.PAYMENT)

  // 1 — a link that already exists is returned as-is, unless the customer
  // cancelled that ComGate payment (its redirect is dead then, and a retry
  // needs a fresh session).
  if (reservation.payment_url && reservation.payment_session_id) {
    const session = await paymentModule
      .retrievePaymentSession(reservation.payment_session_id)
      .catch(() => null)
    const providerStatus = String(
      (session?.data as any)?.provider_status ??
        (session?.data as any)?.providerStatus ??
        ""
    ).toUpperCase()
    const reusable =
      session &&
      session.status !== "canceled" &&
      providerStatus !== "CANCELLED"
    if (reusable) {
      return { payment_url: reservation.payment_url, reused: true }
    }
  }

  const amount = toAmount(reservation.total_price)
  if (!(amount > 0)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Rezervace nemá kladnou cenu — platbu nelze vytvořit."
    )
  }

  // 2 — a standalone collection: no order, no cart, just money to collect.
  const collection = reservation.payment_collection_id
    ? await paymentModule.retrievePaymentCollection(
        reservation.payment_collection_id
      )
    : await paymentModule.createPaymentCollections({
        currency_code: "czk",
        amount,
        metadata: { course_reservation_id: reservation.id },
      })

  if (!reservation.payment_collection_id) {
    await courseService.updateCourseReservations({
      id: reservation.id,
      payment_collection_id: collection.id,
    } as never)
  }

  const { result: session } = await createPaymentSessionsWorkflow(
    container
  ).run({
    input: {
      payment_collection_id: collection.id,
      provider_id: COMGATE_PROVIDER_ID,
      customer_id: reservation.customer_id || undefined,
      data: {
        method: "ALL",
        email: reservation.email,
        phone: reservation.phone || undefined,
        full_name: reservation.name,
        country_code: "CZ",
        label: "Kurz keramiky".slice(0, 16),
        name: `Rezervace kurzu — ${term.title}`,
        lang: "cs",
        category: "OTHER",
        delivery: "ELECTRONIC_DELIVERY",
        url_paid: courseReservationPath(reservation.id, "paid"),
        url_cancelled: courseReservationPath(reservation.id, "cancelled"),
        url_pending: courseReservationPath(reservation.id, "pending"),
      },
    },
  })

  const paymentUrl = paymentUrlFromSession(session)
  if (!paymentUrl) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "ComGate nevrátil platební odkaz."
    )
  }

  await courseService.updateCourseReservations({
    id: reservation.id,
    payment_session_id: (session as any)?.id ?? null,
    payment_url: paymentUrl,
  } as never)

  return { payment_url: paymentUrl, reused: false }
}
