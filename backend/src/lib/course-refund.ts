import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import {
  canAttemptCourseRefund,
  pickRefundablePayment,
} from "../modules/course/lifecycle"
import { toAmount } from "../modules/course/pricing"
import { netCapturedFor, reservationCollectionIds, syncCourseMoney } from "./course-money"
import { refundCourseAmount } from "./course-party-change"

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
    /*
     * Vrací VŠECHNY peníze rezervace: prvotní platbu i doplatky po úpravě
     * počtu osob (lib/course-party-change), minus to, co už se vrátilo
     * (vratka po ubrání osob, nebo dřívější běh, který spadl před razítkem).
     */
    const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
    const requests = (await courseService.listCoursePaymentRequests({ reservation_id: reservation.id } as never)) as any[]
    const amount = await netCapturedFor(container, reservationCollectionIds(reservation, requests))

    if (!(amount > 0)) {
      // Nic zachyceného k vrácení: buď nebylo zaplaceno kartou, nebo už se vše
      // vrátilo (razítko, které nedopadlo) — razítko jen tehdy, když platba byla.
      if (!reservation.payment_collection_id) return { status: "no_card_payment", amount: null }
      await courseService.updateCourseReservations({ id: reservation.id, refunded_at: new Date() } as never)
      await syncCourseMoney(container, reservation.id)
      return { status: "already_refunded", amount: null }
    }

    const refunded = await refundCourseAmount(
      container,
      reservation,
      amount,
      `Zrušená rezervace kurzu ${reservation.id}`
    )
    if (Math.round(refunded * 100) < Math.round(amount * 100)) {
      throw new Error(`vráceno jen ${refunded} z ${amount} Kč`)
    }

    await courseService.updateCourseReservations({
      id: reservation.id,
      refunded_at: new Date(),
    } as never)
    await syncCourseMoney(container, reservation.id)

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
