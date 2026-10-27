import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { toAmount } from "../modules/course/pricing"

/**
 * Evidence peněz rezervace kurzu: `paid_amount` a `amount_due` na rezervaci.
 *
 * Jedno místo, které je počítá — ze skutečnosti, ne z odhadů:
 * - online: součet (zachyceno − vráceno) přes VŠECHNY platby rezervace —
 *   prvotní (`payment_collection_id`) i doplatky (`course_payment_request`),
 * - na místě: cena, když je označeno „zaplaceno na místě", jinak 0,
 * - `amount_due` = cena − zaplaceno (nikdy pod nulu); zrušená rezervace 0.
 *
 * Volá se po každé změně, která peníze nebo cenu hýbe (zaplaceno, doplatek,
 * vrácení, úprava počtu osob, zrušení). Když selže, nic se nerozbije — příští
 * volání to srovná.
 */

const round2 = (value: number) => Math.round(value * 100) / 100

/** Zachyceno − vráceno přes platby v daných kolekcích. */
export const netCapturedFor = async (container: MedusaContainer, collectionIds: string[]): Promise<number> => {
  const ids = [...new Set(collectionIds.filter(Boolean))]
  if (!ids.length) return 0
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "payments.amount", "payments.captured_at", "payments.captures.amount", "payments.refunds.amount"],
    filters: { id: ids },
  })
  let sum = 0
  for (const collection of data as any[]) {
    for (const payment of collection?.payments ?? []) {
      const captures = ((payment?.captures ?? []) as any[]).reduce((s, c) => s + toAmount(c?.amount), 0)
      const captured = captures > 0 ? captures : payment?.captured_at ? toAmount(payment?.amount) : 0
      const refunded = ((payment?.refunds ?? []) as any[]).reduce((s, r) => s + toAmount(r?.amount), 0)
      sum += captured - refunded
    }
  }
  return round2(Math.max(0, sum))
}

/** Kolekce plateb rezervace: prvotní + doplatky. */
export const reservationCollectionIds = (reservation: any, requests: any[]): string[] => [
  reservation?.payment_collection_id,
  ...requests.filter((r) => r?.type === "supplement").map((r) => r?.payment_collection_id),
]

export const moneyFor = (input: {
  total: number
  paid: number
  cancelled: boolean
}): { paid_amount: number; amount_due: number } => ({
  paid_amount: round2(input.paid),
  amount_due: input.cancelled ? 0 : round2(Math.max(0, input.total - input.paid)),
})

/** Přepočítá a uloží `paid_amount` / `amount_due`. Vrací nové hodnoty (nebo null). */
export const syncCourseMoney = async (
  container: MedusaContainer,
  reservationId: string
): Promise<{ paid_amount: number; amount_due: number } | null> => {
  try {
    const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
    const [reservation] = (await courseService.listCourseReservations({ id: reservationId } as never)) as any[]
    if (!reservation) return null
    const requests = (await courseService.listCoursePaymentRequests({ reservation_id: reservationId } as never)) as any[]
    const total = toAmount(reservation.total_price)
    const paid =
      reservation.payment_method === "on_site"
        ? reservation.payment_status === "paid"
          ? total
          : 0
        : await netCapturedFor(container, reservationCollectionIds(reservation, requests))
    const money = moneyFor({ total, paid, cancelled: reservation.status === "cancelled" })
    if (toAmount(reservation.paid_amount) !== money.paid_amount || toAmount(reservation.amount_due) !== money.amount_due) {
      await courseService.updateCourseReservations({ id: reservationId, ...money } as never)
    }
    return money
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[kurzy] Evidenci plateb rezervace ${reservationId} se nepodařilo přepočítat: ${(error as Error)?.message ?? error}`)
    return null
  }
}
