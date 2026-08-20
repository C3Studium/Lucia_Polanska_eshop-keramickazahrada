import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../../../modules/merchant-order"
import MerchantOrderModuleService from "../../../modules/merchant-order/service"
import {
  MERCHANT_ORDER_STAGES,
  type MerchantOrderStage,
} from "../../../modules/merchant-order/stages"
import { toMerchantOrderRow } from "./projection"

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

/**
 * Fields handed to `getOrdersListWorkflow`.
 *
 * `items.*` is mandatory rather than a convenience: `order.total` is not a column,
 * it is derived by `decorateCartTotals()` from `unit_price * quantity`. Selecting a
 * narrow subset of item columns silently yields wrong totals, because MikroORM drops
 * unlisted columns from the projection. The native list workflow adds `items.*` for
 * exactly this reason, and we mirror it.
 *
 * `payment_collections` / `fulfillments` are requested explicitly because the workflow
 * strips them from its output unless the caller asked for them, and we need them for
 * the payment and shipping badges.
 */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  "total",
  // `metadata.refund_due` drives the „Vrátit rozdíl" button in the queue.
  "metadata",
  "items.*",
  // `summary` and the collection amounts are what the A2 ship gate compares —
  // the card must not offer an action the backend would refuse.
  "summary.*",
  "shipping_methods.*",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.payments.provider_id",
  "fulfillments.id",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const stage =
    typeof req.query.stage === "string" &&
    MERCHANT_ORDER_STAGES.includes(req.query.stage as MerchantOrderStage)
      ? (req.query.stage as MerchantOrderStage)
      : undefined

  const [states, count] = await service.listAndCountMerchantOrderStates(
    (stage ? { stage } : {}) as any,
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )

  const orderIds = states.map((state: any) => state.order_id)

  // Orders always come from the native list workflow. It is the only supported way to
  // obtain `total`, `payment_status` and `fulfillment_status`: the first is derived from
  // the full item projection, the latter two do not exist on the `order` entity at all
  // and are computed by `getLastPaymentStatus()` / `getLastFulfillmentStatus()` inside
  // this workflow.
  let orders: any[] = []
  if (orderIds.length) {
    const { result } = await getOrdersListWorkflow(req.scope).run({
      input: {
        fields: ORDER_FIELDS,
        variables: { filters: { id: orderIds } },
      },
    })
    // The workflow returns a bare array when no pagination is requested, and
    // `{ rows, metadata }` when it is. Pagination happens on the state table here,
    // but normalise both shapes so this cannot silently break.
    orders = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
  }

  // Read-only module links are uni-directional: `production_order -> order` can only be
  // traversed from `production_order`. Querying `production_order` from `order` silently
  // returns nothing, which is why the made-to-order badge never rendered.
  const { data: productionOrders } = orderIds.length
    ? await query.graph({
        entity: "production_order",
        fields: [
          "id",
          "order_id",
          "stage",
          "agreed_total",
          "original_total",
          "payment_requests.status",
          "payment_requests.amount",
        ],
        filters: { order_id: orderIds },
      })
    : { data: [] as any[] }

  // Order changes are a separate entity, and an open one means the total is
  // still moving — the gate has to see them.
  const { data: orderChanges } = orderIds.length
    ? await query.graph({
        entity: "order_change",
        fields: ["id", "order_id", "status"],
        filters: { order_id: orderIds },
      })
    : { data: [] as any[] }

  const orderById = new Map(orders.map((order: any) => [order.id, order]))
  const productionByOrderId = new Map(
    productionOrders.map((production: any) => [production.order_id, production])
  )
  const changesByOrderId = new Map<string, any[]>()
  for (const change of orderChanges as any[]) {
    const existing = changesByOrderId.get(change.order_id) || []
    existing.push(change)
    changesByOrderId.set(change.order_id, existing)
  }

  const rows = states.map((state: any) =>
    toMerchantOrderRow(
      state,
      orderById.get(state.order_id) || null,
      productionByOrderId.get(state.order_id) || null,
      changesByOrderId.get(state.order_id) || []
    )
  )

  // Counting per stage keeps this O(stages) indexed count queries instead of loading
  // every state row into memory just to bucket it.
  const summaryEntries = await Promise.all(
    MERCHANT_ORDER_STAGES.map(async (item) => {
      const [, stageCount] = await service.listAndCountMerchantOrderStates(
        { stage: item } as any,
        { take: 1 }
      )
      return [item, stageCount] as const
    })
  )
  const summary = Object.fromEntries(summaryEntries) as Record<
    MerchantOrderStage,
    number
  >

  res.status(200).json({ orders: rows, count, limit, offset, summary })
}
