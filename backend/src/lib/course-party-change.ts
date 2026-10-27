import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { toAmount } from "../modules/course/pricing"
import { COMGATE_PROVIDER_ID, paymentUrlFromSession } from "./balance-payment"
import { courseReservationPath } from "./course-reservation-link"
import { syncCourseMoney } from "./course-money"
import { paymentStatusFromProvider } from "./payment-provider-status"
import { notifyMerchant } from "./notify"

/**
 * Změna počtu osob u ZAPLACENÉ online rezervace kurzu (vzor zakázky).
 *
 * Cena se přepočítá podle nového počtu (i cenová hladina na osobu) a rozdíl
 * proti tomu, co zákazník u nás má zaplaceno (`paid_amount`):
 *
 * - víc → DOPLATEK: vlastní ComGate platba za rozdíl (`course_payment_request`
 *   typu `supplement`). Zákazník jde rovnou na bránu; dokud nezaplatí, je
 *   rozdíl v `amount_due` a stránka i e-mail nabízí „Doplatit". Zaplacení
 *   pozná oznámení, živá kontrola stránky i dohled (lib/course-payment-reconcile).
 * - míň → VRÁCENÍ: rozdíl se vrátí přes ComGate z plateb rezervace (nejnovější
 *   napřed); záznam typu `refund`. Když vrácení selže, majitelka dostane zprávu
 *   a vrátí ručně.
 *
 * Každá nová úprava zruší rozpracovaný doplatek a spočítá rozdíl znovu.
 */

const round2 = (value: number) => Math.round(value * 100) / 100

const listRequests = async (container: MedusaContainer, reservationId: string) =>
  (await container
    .resolve<CourseModuleService>(COURSE_MODULE)
    .listCoursePaymentRequests({ reservation_id: reservationId } as never, { order: { created_at: "DESC" } } as never)) as any[]

/** Zruší rozpracované doplatky (nová úprava je nahrazuje). */
export const cancelPendingSupplements = async (container: MedusaContainer, reservationId: string) => {
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const pending = (await listRequests(container, reservationId)).filter(
    (r) => r.type === "supplement" && r.status === "pending"
  )
  for (const request of pending) {
    await courseService.updateCoursePaymentRequests({ id: request.id, status: "cancelled" } as never)
  }
}

/** Živý stav platby doplatku u brány, nebo null. */
const supplementGatewayStatus = async (container: MedusaContainer, request: any): Promise<string | null> => {
  if (!request?.payment_session_id) return null
  const paymentModule = container.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({ id: request.payment_session_id } as never)
  if (!session) return null
  return String((await paymentStatusFromProvider(container, session as any))?.status ?? "").toLowerCase() || null
}

/**
 * Odkaz na zaplacení doplatku (`amount_due`). Živý rozpracovaný doplatek se
 * stejnou částkou se vrátí (dvojklik = jedna platba), zrušený u brány nikdy.
 */
export const ensureCourseSupplementLink = async (
  container: MedusaContainer,
  { reservation, term }: { reservation: any; term: any }
): Promise<{ payment_url: string; amount: number; request_id: string }> => {
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const amount = round2(toAmount(reservation.amount_due))
  if (!(amount > 0)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "U rezervace není co doplácet.")
  }

  const open = (await listRequests(container, reservation.id)).find(
    (r) => r.type === "supplement" && r.status === "pending"
  )
  if (open && round2(toAmount(open.amount)) === amount && open.payment_url) {
    const live = await supplementGatewayStatus(container, open).catch(() => null)
    if (live !== "canceled") return { payment_url: open.payment_url, amount, request_id: open.id }
  }
  if (open) {
    await courseService.updateCoursePaymentRequests({ id: open.id, status: "cancelled" } as never)
  }

  const paymentModule = container.resolve(Modules.PAYMENT)
  const request = (await courseService.createCoursePaymentRequests({
    reservation_id: reservation.id,
    type: "supplement",
    status: "pending",
    amount,
    party_size: Math.trunc(toAmount(reservation.party_size)),
    total_price: toAmount(reservation.total_price),
  } as never)) as any
  const collection = await paymentModule.createPaymentCollections({
    currency_code: "czk",
    amount,
    metadata: { course_reservation_id: reservation.id, course_payment_request_id: request.id },
  })

  const { result: session } = await createPaymentSessionsWorkflow(container).run({
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
        label: "Kurz doplatek".slice(0, 16),
        name: `Doplatek kurzu — ${term.title}`,
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
    await courseService.updateCoursePaymentRequests({ id: request.id, status: "cancelled", note: "ComGate nevrátil platební odkaz." } as never)
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "ComGate nevrátil platební odkaz.")
  }
  await courseService.updateCoursePaymentRequests({
    id: request.id,
    payment_collection_id: collection.id,
    payment_session_id: (session as any)?.id ?? null,
    payment_url: paymentUrl,
  } as never)
  return { payment_url: paymentUrl, amount, request_id: request.id }
}

/**
 * Vrátí `amount` z ComGate plateb rezervace (doplatky od nejnovějšího, pak
 * prvotní platba). Vrací skutečně vrácenou částku.
 */
export const refundCourseAmount = async (
  container: MedusaContainer,
  reservation: any,
  amount: number,
  note: string
): Promise<number> => {
  const requests = await listRequests(container, reservation.id)
  const collectionIds = [
    ...requests.filter((r) => r.type === "supplement" && r.payment_collection_id).map((r) => r.payment_collection_id),
    reservation.payment_collection_id,
  ].filter(Boolean)
  if (!collectionIds.length) return 0

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const paymentModule = container.resolve(Modules.PAYMENT)
  let left = round2(amount)
  let refunded = 0
  for (const collectionId of collectionIds) {
    if (!(left > 0)) break
    const { data } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "payments.id", "payments.provider_id", "payments.amount", "payments.captured_at", "payments.captures.amount", "payments.refunds.amount"],
      filters: { id: collectionId },
    })
    for (const payment of ((data as any[])[0]?.payments ?? []) as any[]) {
      if (!(left > 0)) break
      if (!String(payment?.provider_id ?? "").includes("comgate")) continue
      const captures = ((payment.captures ?? []) as any[]).reduce((s, c) => s + toAmount(c?.amount), 0)
      const captured = captures > 0 ? captures : payment.captured_at ? toAmount(payment.amount) : 0
      const already = ((payment.refunds ?? []) as any[]).reduce((s, r) => s + toAmount(r?.amount), 0)
      const refundable = round2(captured - already)
      if (!(refundable > 0)) continue
      const take = round2(Math.min(refundable, left))
      await paymentModule.refundPayment({ payment_id: payment.id, amount: take, note })
      refunded = round2(refunded + take)
      left = round2(left - take)
    }
  }
  return refunded
}

export type PartyChangeOutcome =
  | { action: "none" }
  | { action: "supplement"; amount: number; payment_url: string }
  | { action: "refund"; amount: number; refunded: boolean }

/**
 * Po přepočtu ceny (service `updateReservationPartySize`) srovná peníze.
 * Jen u online rezervace, která už něco zaplatila; jinak nic (platba na místě
 * nebo nezaplacená online platba se řeší novou cenou samy).
 */
export const settleCoursePartyChange = async (
  container: MedusaContainer,
  { reservationId, term }: { reservationId: string; term: any }
): Promise<PartyChangeOutcome> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)

  await cancelPendingSupplements(container, reservationId)
  const money = await syncCourseMoney(container, reservationId)
  const [reservation] = (await courseService.listCourseReservations({ id: reservationId } as never)) as any[]
  if (!reservation || !money || reservation.payment_method !== "online" || !(money.paid_amount > 0)) {
    return { action: "none" }
  }

  const total = toAmount(reservation.total_price)
  if (money.amount_due > 0) {
    const link = await ensureCourseSupplementLink(container, { reservation: { ...reservation, ...money }, term })
    return { action: "supplement", amount: link.amount, payment_url: link.payment_url }
  }

  const overpaid = round2(money.paid_amount - total)
  if (!(overpaid > 0)) return { action: "none" }

  const request = (await courseService.createCoursePaymentRequests({
    reservation_id: reservationId,
    type: "refund",
    status: "pending",
    amount: overpaid,
    party_size: Math.trunc(toAmount(reservation.party_size)),
    total_price: total,
  } as never)) as any
  try {
    const refunded = await refundCourseAmount(
      container,
      reservation,
      overpaid,
      `Úprava rezervace kurzu ${reservationId}: ${reservation.party_size} os.`
    )
    const complete = round2(refunded) >= overpaid
    await courseService.updateCoursePaymentRequests({
      id: request.id,
      status: complete ? "refunded" : "failed",
      paid_at: refunded > 0 ? new Date() : null,
      note: complete ? null : `Automaticky vráceno ${refunded} Kč z ${overpaid} Kč — zbytek vrátit ručně.`,
    } as never)
    await syncCourseMoney(container, reservationId)
    if (!complete) throw new Error(`vráceno jen ${refunded} z ${overpaid} Kč`)
    logger.info(`[kurzy] Rezervace ${reservationId}: po úpravě počtu osob vráceno ${overpaid} Kč přes ComGate.`)
    return { action: "refund", amount: overpaid, refunded: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await courseService
      .updateCoursePaymentRequests({ id: request.id, status: "failed", note: message } as never)
      .catch(() => undefined)
    await notifyMerchant(container, {
      key: `course-refund-failed:${request.id}`,
      title: `Kurzy: vrácení rozdílu se nepovedlo — ${reservation.name}`,
      description: [
        `Zákazník ubral osoby na ${reservation.party_size} a má dostat zpět ${overpaid} Kč.`,
        `Automatické vrácení přes ComGate selhalo (${message}) — vraťte prosím ručně.`,
      ].join("\n"),
      audience: "owner",
    }).catch(() => undefined)
    return { action: "refund", amount: overpaid, refunded: false }
  }
}
