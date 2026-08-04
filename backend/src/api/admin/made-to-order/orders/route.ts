import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"

/**
 * The commissions queue (§7.2, §22).
 *
 * Read-only for now: **P6-1** adds the per-stage actions on top of this. What
 * it already answers is the question Matěj asked for — how much of the agreed
 * price has actually been paid — because a commission is the one order type
 * where „paid" is a spectrum rather than a yes/no, and she cannot judge the
 * next step without seeing where on it a given piece sits.
 *
 * Money comes from the module's own payment-request snapshots, never from
 * re-deriving what the customer owes.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

/** Stage order as she works through them, terminal stages last. */
export const PRODUCTION_STAGE_ORDER = [
  "specification_pending",
  "confirmed",
  "in_production",
  "awaiting_balance",
  "ready_to_ship",
  "completed",
  "cancelled",
] as const

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(asPositiveInt(req.query.limit, 100), 200)
  const offset = asPositiveInt(req.query.offset, 0)
  const stage =
    typeof req.query.stage === "string" &&
    (PRODUCTION_STAGE_ORDER as readonly string[]).includes(req.query.stage)
      ? req.query.stage
      : undefined

  const [productionOrders, count] = await service.listAndCountProductionOrders(
    (stage ? { stage } : {}) as never,
    {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
      relations: ["payment_requests"],
    }
  )

  const orderIds = (productionOrders as any[]).map(
    (production) => production.order_id
  )

  // The commission stores no customer data of its own — it is an overlay on a
  // native order, which is where the person and the order number live.
  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "email",
          "created_at",
          "customer.first_name",
          "customer.last_name",
        ],
        filters: { id: orderIds },
      })
    : { data: [] as any[] }

  const orderById = new Map((orders as any[]).map((order) => [order.id, order]))

  const rows = (productionOrders as any[]).map((production) => {
    const requests = production.payment_requests || []
    const paid = requests
      .filter((request: any) => request?.status === "paid")
      .reduce((sum: number, request: any) => sum + toNumber(request.amount), 0)
    const agreed = toNumber(production.agreed_total ?? production.original_total)
    const order = orderById.get(production.order_id)

    const name = [order?.customer?.first_name, order?.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim()

    const openBalance = requests.find(
      (request: any) =>
        request?.type === "balance" &&
        ["draft", "pending", "sent"].includes(request?.status)
    )

    return {
      id: production.id,
      order_id: production.order_id,
      display_id: order?.display_id ?? null,
      customer_name: name || order?.email || null,
      created_at: order?.created_at ?? production.created_at,
      stage: production.stage,
      currency_code: String(production.currency_code || "czk"),

      // The money picture, which is the whole point of this list.
      agreed_total: agreed,
      paid_total: paid,
      outstanding: Math.max(0, agreed - paid),
      deposit_percentage: toNumber(production.deposit_percentage),
      has_open_balance_request: Boolean(openBalance),
      balance_requested_at: production.balance_requested_at ?? null,

      estimated_completion_at: production.estimated_completion_at ?? null,
      customer_note: production.customer_note ?? null,
      internal_note: production.internal_note ?? null,
    }
  })

  // Counts for every stage, so the page can label its sections without
  // loading each one.
  const summaryEntries = await Promise.all(
    PRODUCTION_STAGE_ORDER.map(async (item) => {
      const [, stageCount] = await service.listAndCountProductionOrders(
        { stage: item } as never,
        { take: 1 }
      )
      return [item, stageCount] as const
    })
  )

  res.status(200).json({
    production_orders: rows,
    count,
    limit,
    offset,
    summary: Object.fromEntries(summaryEntries),
  })
}
