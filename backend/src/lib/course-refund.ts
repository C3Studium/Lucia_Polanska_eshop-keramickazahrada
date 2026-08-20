import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import {
  canAttemptCourseRefund,
  pickRefundablePayment,
} from "../modules/course/lifecycle"
import { toAmount } from "../modules/course/pricing"
import { COMGATE_PROVIDER_ID } from "./balance-payment"

/**
 * Automatic ComGate refunds for cancelled course reservations.
 *
 * ## The path of the money
 *
 * A paid reservation owns exactly one payment collection (created per
 * reservation in `course-payment.ts`), which holds the one captured ComGate
 * payment. Cancelling calls the payment module's `refundPayment` directly —
 * NOT `refundPaymentWorkflow`: that workflow resolves the collection's order
 * with `throw_if_key_not_found` and course collections are deliberately
 * standalone (no order), so the workflow would fail before ever reaching the
 * provider. The module method is also the stronger guard: it locks the
 * payment row, re-reads captures and refunds under the lock and refuses to
 * refund more than was captured — two concurrent cancels serialize there,
 * and the ComGate provider tracks its own refunded total on top.
 *
 * ## Never twice
 *
 * Our own guard is `refunded_at`: stamped after a successful refund, checked
 * before every attempt. A retried cancel route, a re-clicked prompt or a
 * re-run term cancel therefore walks past already-refunded rows. The amount
 * is what is still refundable — captured minus already refunded — so a crash
 * *between* the refund succeeding and the stamp being written self-heals on
 * retry: the remaining amount is zero, the row is stamped, no second refund
 * is attempted.
 */

export type CourseRefundOutcome =
  /** Money is on its way back; `refunded_at` is stamped. */
  | { status: "refunded"; amount: number }
  /** A previous run already returned it — nothing to do. */
  | { status: "already_refunded"; amount: null }
  /** Not paid online / no captured ComGate payment — manual territory. */
  | { status: "no_card_payment"; amount: null }
  /** The workflow failed; the owner returns this one by hand. */
  | { status: "failed"; amount: null; message: string }

export const refundCourseReservation = async (
  container: MedusaContainer,
  reservation: any
): Promise<CourseRefundOutcome> => {
  if (reservation?.refunded_at) {
    return { status: "already_refunded", amount: null }
  }
  if (!canAttemptCourseRefund(reservation ?? {})) {
    return { status: "no_card_payment", amount: null }
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: collections } = await query.graph({
      entity: "payment_collection",
      fields: [
        "id",
        "payments.id",
        "payments.provider_id",
        "payments.amount",
        "payments.captured_at",
        "payments.canceled_at",
        "payments.captures.amount",
        "payments.refunds.amount",
      ],
      filters: { id: reservation.payment_collection_id },
    })
    const payments = ((collections[0] as any)?.payments ?? []) as any[]
    const payment = pickRefundablePayment(payments, COMGATE_PROVIDER_ID) as any

    if (!payment) {
      // Paid per our books but no captured ComGate payment to pull back —
      // the state the manual fallback exists for.
      return { status: "no_card_payment", amount: null }
    }

    // What is still refundable: captured minus already refunded. On the happy
    // path that is simply the full amount (course collections hold exactly one
    // full-capture payment) — but if a previous run refunded the money and
    // crashed before stamping `refunded_at`, the retry lands here with zero
    // remaining and must stamp instead of refunding twice.
    const capturesSum = ((payment.captures ?? []) as any[]).reduce(
      (sum, capture) => sum + toAmount(capture?.amount),
      0
    )
    const captured = capturesSum > 0 ? capturesSum : toAmount(payment.amount)
    const alreadyRefunded = ((payment.refunds ?? []) as any[]).reduce(
      (sum, refund) => sum + toAmount(refund?.amount),
      0
    )
    const amount = Math.round((captured - alreadyRefunded) * 100) / 100

    if (!(captured > 0)) {
      return { status: "no_card_payment", amount: null }
    }

    const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

    if (!(amount > 0)) {
      // The money already went back (a stamp that never landed) — record the
      // fact and report it as the already-refunded case it is.
      await courseService.updateCourseReservations({
        id: reservation.id,
        refunded_at: new Date(),
      } as never)
      return { status: "already_refunded", amount: null }
    }

    const paymentModule = container.resolve(Modules.PAYMENT)
    await paymentModule.refundPayment({
      payment_id: payment.id,
      amount,
      note: `Zrušená rezervace kurzu ${reservation.id}`,
    })

    await courseService.updateCourseReservations({
      id: reservation.id,
      refunded_at: new Date(),
    } as never)

    logger.info(
      `[kurzy] Rezervace ${reservation.id} (${reservation.name}) — vráceno ${amount} Kč přes ComGate.`
    )
    return { status: "refunded", amount }
  } catch (error) {
    const message = error instanceof Error ? error.message : "neznámá chyba"
    logger.error(
      `[kurzy] Automatické vrácení platby rezervace ${reservation.id} selhalo: ${message}`
    )
    return { status: "failed", amount: null, message }
  }
}
