import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"

/**
 * Zakázky jedné objednávky (LEGAL_AUDIT.md § 0c, Z-A: zakázka = položka, ne
 * objednávka). Do 20. 10. 2026 platilo `const [productionOrder] =
 * listProductionOrders({ order_id })` — od teď má objednávka zakázek víc a
 * každé místo si musí říct, kterou chce:
 *
 * - souhrn za objednávku (brána odeslání, fakturace, průběh) → `listCommissionsOfOrder`
 *   a sečíst;
 * - jedna konkrétní zakázka (akce, zrušení, doplatek, diář) → `commissionOfOrder`
 *   s `production_order_id`; bez něj projde jen objednávka s PRÁVĚ JEDNOU
 *   zakázkou (všechny dnešní objednávky na produkci), u víc zakázek je to chyba
 *   volajícího, ne tichý výběr první.
 *
 * Pořadí: podle `created_at`, pak `id` — první zakázka objednávky je ta, která
 * za objednávku nese dopravu a balné (`lib/made-to-order/commission-money`).
 */

export const MULTIPLE_COMMISSIONS_MESSAGE =
  "Objednávka má víc zakázek — uveďte production_order_id."

export const NO_COMMISSION_MESSAGE = "K této objednávce není zakázková výroba."

const timeOf = (value: unknown): number => {
  const time = new Date((value as string) ?? 0).getTime()
  return Number.isFinite(time) ? time : 0
}

/** Stabilní pořadí zakázek objednávky (čisté). */
export const sortCommissions = <T extends { id?: string; created_at?: unknown }>(
  commissions: T[]
): T[] =>
  [...commissions].sort(
    (a, b) =>
      timeOf(a.created_at) - timeOf(b.created_at) ||
      String(a.id ?? "").localeCompare(String(b.id ?? ""))
  )

/**
 * ČISTÉ: vybere zakázku ze seznamu. Bez id a právě jedna → ta; bez id a víc
 * → `INVALID_DATA`; s id, které v seznamu není → `NOT_FOUND` (cizí zakázka
 * se k objednávce nepřipne).
 */
export const pickCommission = <T extends { id?: string }>(
  commissions: T[],
  productionOrderId?: string | null
): T | null => {
  if (!commissions.length) return null
  if (productionOrderId) {
    const found = commissions.find((candidate) => candidate.id === productionOrderId)
    if (!found) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Zakázka k této objednávce nebyla nalezena."
      )
    }
    return found
  }
  if (commissions.length === 1) return commissions[0]
  throw new MedusaError(MedusaError.Types.INVALID_DATA, MULTIPLE_COMMISSIONS_MESSAGE)
}

export const listCommissionsOfOrder = async (
  container: MedusaContainer,
  orderId: string,
  options: { relations?: string[] } = {}
): Promise<any[]> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const rows = (await madeToOrder.listProductionOrders(
    { order_id: orderId } as never,
    (options.relations ? { relations: options.relations } : {}) as never
  )) as any[]
  return sortCommissions(rows)
}

/**
 * Jedna zakázka objednávky, nebo `null`, když objednávka žádnou nemá.
 * Víc zakázek bez `production_order_id` → chyba (viz hlavička).
 */
export const commissionOfOrder = async (
  container: MedusaContainer,
  orderId: string,
  productionOrderId?: string | null,
  options: { relations?: string[] } = {}
): Promise<any | null> => {
  const commissions = await listCommissionsOfOrder(container, orderId, options)
  return pickCommission(commissions, productionOrderId)
}

/** Totéž, ale bez zakázky je to 404 — pro routy, které zakázku vyžadují. */
export const requireCommissionOfOrder = async (
  container: MedusaContainer,
  orderId: string,
  productionOrderId?: string | null,
  options: { relations?: string[] } = {}
): Promise<any> => {
  const commission = await commissionOfOrder(container, orderId, productionOrderId, options)
  if (!commission) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, NO_COMMISSION_MESSAGE)
  }
  return commission
}

/** `production_order_id` z query nebo těla požadavku (string, nebo null). */
export const commissionIdFromRequest = (req: {
  query?: Record<string, unknown>
  body?: unknown
}): string | null => {
  const fromQuery = req.query?.production_order_id
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim()
  const fromBody = (req.body as Record<string, unknown> | null | undefined)?.production_order_id
  return typeof fromBody === "string" && fromBody.trim() ? fromBody.trim() : null
}

/** Žádosti o platbu všech zakázek objednávky, roztříděné podle zakázky. */
export const paymentRequestsByCommission = async (
  container: MedusaContainer,
  commissions: Array<{ id: string }>
): Promise<Map<string, any[]>> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const ids = commissions.map((commission) => commission.id)
  const requests = ids.length
    ? ((await madeToOrder.listProductionPaymentRequests(
        { production_order_id: ids } as never,
        { order: { created_at: "ASC" } } as never
      )) as any[])
    : []
  const byCommission = new Map<string, any[]>(ids.map((id) => [id, []]))
  for (const request of requests) {
    const list = byCommission.get(request.production_order_id) ?? []
    list.push(request)
    byCommission.set(request.production_order_id, list)
  }
  return byCommission
}
