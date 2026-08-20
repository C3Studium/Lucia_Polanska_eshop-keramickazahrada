import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { formatCourseDate, sendCourseReservationConfirmedEmail } from "../lib/course-emails"
import { ensureInvoiceForCourseReservation } from "../lib/course-invoice"
import { notifyMerchant } from "../lib/notify"

/**
 * When a course reservation's ComGate payment arrives.
 *
 * The verified push notification flows through the existing
 * `/hooks/payment/pp_comgate_comgate` route → `processPaymentWorkflow`, which
 * authorizes and captures the standalone payment session and emits
 * `payment.captured` — the same event order payments emit. This subscriber is
 * the course-side reconciliation: it recognizes its own payments by the
 * session id stored on the reservation and leaves everything else alone
 * (order payments have no matching reservation and return in one query).
 *
 * Everything here is idempotent, because event delivery is at-least-once:
 * `paid_at` is only set once, the invoice is keyed by
 * `idoklad_invoice_id`, and the e-mails dedupe on notification keys. A
 * re-delivered event therefore self-heals a partial failure (say, the invoice
 * succeeded but the e-mail did not) instead of doubling anything.
 */
export default async function coursePaymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "captured_at", "payment_session_id", "payment_collection_id"],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const sessionId = payment?.payment_session_id
  if (!sessionId) {
    return
  }

  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const reservations = (await courseService.listCourseReservations(
    { payment_session_id: sessionId } as never,
    { relations: ["term"] } as never
  )) as any[]

  if (!reservations.length) {
    // Usually not a course payment at all — an order or balance payment owns
    // this session. But one course case lands here too: a party-size edit
    // replaced the reservation's payment link while the customer's OLD
    // ComGate window stayed open, and they paid the stale amount. The course
    // collection carries the reservation id in its metadata, so that case is
    // recognizable — and must be loud, because the money no longer matches
    // the reservation and has to be reconciled by hand.
    const collectionId = payment?.payment_collection_id
    if (collectionId) {
      const { data: collections } = await query.graph({
        entity: "payment_collection",
        fields: ["id", "metadata"],
        filters: { id: collectionId },
      })
      const staleReservationId = (collections[0] as any)?.metadata
        ?.course_reservation_id
      if (staleReservationId) {
        const [stale] = (await courseService.listCourseReservations(
          { id: staleReservationId } as never
        )) as any[]
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(
            `[kurzy] Platba dorazila přes starý (nahrazený) odkaz rezervace ${staleReservationId} — částka nemusí odpovídat, vyřešte ručně.`
          )
        await notifyMerchant(container, {
          key: `course-res-stale-payment:${staleReservationId}:${sessionId}`,
          title: `Kurzy: platba přes starý odkaz — ${stale?.name ?? staleReservationId}`,
          description: [
            stale
              ? `${stale.party_size} os. · ${stale.name}${
                  stale.email ? ` <${stale.email}>` : ""
                }`
              : `Rezervace ${staleReservationId}`,
            "Zákazník zaplatil přes platební odkaz, který mezitím nahradila změna počtu osob — zaplacená částka nemusí odpovídat aktuální ceně rezervace. Zkontrolujte prosím platbu v ComGate a srovnejte ručně (doplatek / vrácení).",
          ].join("\n"),
          audience: "owner",
          urgent: true,
        }).catch(() => undefined)
      }
    }
    return
  }

  const reservation = reservations[0]
  const term = reservation.term
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  if (!term) {
    logger.error(
      `[kurzy] Rezervace ${reservation.id} nemá termín — platbu nelze spárovat.`
    )
    return
  }

  // The reservation (or its whole term) was cancelled while the customer's
  // ComGate window was still open. The money is recorded so the admin sees
  // „zaplaceno" on the cancelled row, but no invoice is issued and no „místo
  // je vaše" e-mail goes out — instead the owner hears about it loudly,
  // because the payment has to be returned by hand.
  if (reservation.status === "cancelled" || term.status === "cancelled") {
    if (reservation.payment_status !== "paid") {
      await courseService.updateCourseReservations({
        id: reservation.id,
        payment_status: "paid",
        paid_at: payment.captured_at
          ? new Date(payment.captured_at)
          : new Date(),
      } as never)
    }
    logger.warn(
      `[kurzy] Platba dorazila ke zrušené rezervaci ${reservation.id} (${reservation.name}) — peníze je nutné vrátit ručně.`
    )
    await notifyMerchant(container, {
      key: `course-res-paid-cancelled:${reservation.id}`,
      title: `Kurzy: platba u zrušené rezervace — ${reservation.name}`,
      description: [
        `${term.title} · ${formatCourseDate(term.starts_at)}`,
        `${reservation.party_size} os. · ${reservation.name}${
          reservation.email ? ` <${reservation.email}>` : ""
        }${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
        "Rezervace byla mezitím zrušena, ale platba kartou dorazila — peníze prosím vraťte ručně.",
      ].join("\n"),
      audience: "owner",
      urgent: true,
    }).catch(() => undefined)
    return
  }

  const firstCapture = reservation.payment_status !== "paid"
  if (firstCapture) {
    await courseService.updateCourseReservations({
      id: reservation.id,
      payment_status: "paid",
      paid_at: payment.captured_at ? new Date(payment.captured_at) : new Date(),
    } as never)
    reservation.payment_status = "paid"
    reservation.paid_at = payment.captured_at || new Date().toISOString()
    logger.info(
      `[kurzy] Rezervace ${reservation.id} (${reservation.name}) je zaplacená.`
    )

    // Mirror of the expiry job's own race guard: the hourly job may have
    // cancelled this reservation in the instant between our read above and
    // the paid-update. Re-read the status — if the cancel won, this payment
    // is money without a seat and must go down the loud manual-refund path,
    // not get a „místo je vaše" confirmation.
    const [recheck] = (await courseService.listCourseReservations(
      { id: reservation.id } as never
    )) as any[]
    if (recheck?.status === "cancelled") {
      logger.warn(
        `[kurzy] Platba dorazila ke zrušené rezervaci ${reservation.id} (${reservation.name}) — peníze je nutné vrátit ručně.`
      )
      await notifyMerchant(container, {
        key: `course-res-paid-cancelled:${reservation.id}`,
        title: `Kurzy: platba u zrušené rezervace — ${reservation.name}`,
        description: [
          `${term.title} · ${formatCourseDate(term.starts_at)}`,
          `${reservation.party_size} os. · ${reservation.name}${
            reservation.email ? ` <${reservation.email}>` : ""
          }${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
          "Rezervace byla mezitím zrušena, ale platba kartou dorazila — peníze prosím vraťte ručně.",
        ].join("\n"),
        audience: "owner",
        urgent: true,
      }).catch(() => undefined)
      return
    }
  }

  // Invoice first, so the confirmation e-mail can carry the PDF link. A
  // failed invoice never blocks the confirmation — the customer paid and
  // must hear back either way.
  const invoice = await ensureInvoiceForCourseReservation(
    container,
    reservation,
    term
  )

  await sendCourseReservationConfirmedEmail(container, reservation, term, {
    variant: "paid",
    invoicePdfUrl: invoice.pdf_url ?? reservation.idoklad_pdf_url ?? null,
  }).catch((error) => {
    logger.error(
      `[kurzy] Potvrzení rezervace ${reservation.id} se nepodařilo odeslat: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  })

  if (firstCapture) {
    await notifyMerchant(container, {
      key: `course-res-paid:${reservation.id}`,
      title: `Kurzy: zaplacená rezervace — ${reservation.name}`,
      description: [
        `${term.title} · ${formatCourseDate(term.starts_at)}`,
        `${reservation.party_size} os. · ${reservation.name}${
          reservation.email ? ` <${reservation.email}>` : ""
        }${reservation.phone ? `, tel. ${reservation.phone}` : ""}`,
        `Zaplaceno předem kartou.`,
      ].join("\n"),
      audience: "owner",
      email: true,
    }).catch(() => undefined)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
