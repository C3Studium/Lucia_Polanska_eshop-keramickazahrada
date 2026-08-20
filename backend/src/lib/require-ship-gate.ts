import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { evaluateShipGate, type ShipGateInput } from "./ship-gate"

/**
 * The A2 ship gate as a guard on the **native** fulfilment routes
 * (WorkflowPlan.md P4-4, §18, AC-3).
 *
 * ## Why a middleware and not a workflow hook
 *
 * `createOrderFulfillmentWorkflow` exposes only `fulfillmentCreated`, which runs
 * *after* the fulfilment exists and inventory has moved — far too late to
 * refuse. There is no `validate` hook. Middleware on the route is therefore the
 * only place a native fulfilment can be stopped before it happens.
 *
 * ## Why it is needed at all
 *
 * The queue already refuses to dispatch an unpaid order, but the queue is not
 * the only door. The native order page can create a fulfilment and a shipment
 * directly, and so can anything holding an admin token. A money rule enforced
 * on one screen is a money rule that will eventually be walked around — by a
 * bookmark, a habit, or a support session on the native page.
 *
 * The rules themselves are the shared ones in `./ship-gate`, so this cannot
 * drift from what the queue enforces.
 */

const ORDER_FIELDS = [
  "id",
  "currency_code",
  // `total` is derived from the item projection; without `items.*` it is zero,
  // which would make every order look overpaid and let everything through.
  "total",
  "items.*",
  "summary.*",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.payments.provider_id",
  "payment_collections.refunded_amount",
]

/**
 * Loads exactly what the gate needs. Three queries because two of them cannot
 * be reached from the order: read-only module links are uni-directional, so a
 * production order is queried from its own side, and order changes are their
 * own entity.
 */
export const loadShipGateInput = async (
  scope: MedusaRequest["scope"],
  orderId: string
): Promise<ShipGateInput | null> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order) {
    return null
  }

  const [{ data: productionOrders }, { data: orderChanges }] = await Promise.all([
    query.graph({
      entity: "production_order",
      fields: [
        "id",
        "agreed_total",
        "original_total",
        "payment_requests.status",
        "payment_requests.amount",
      ],
      filters: { order_id: orderId },
    }),
    query.graph({
      entity: "order_change",
      fields: ["id", "status"],
      filters: { order_id: orderId },
    }),
  ])

  return {
    currency_code: order.currency_code,
    total: order.total,
    summary: order.summary,
    payment_collections: order.payment_collections || [],
    order_changes: (orderChanges as any[]) || [],
    production_order: ((productionOrders as any[])[0] as any) ?? null,
  }
}

/**
 * Rejects a native fulfilment or shipment for an order that is not paid for.
 *
 * The order id is read from `req.params.id`, which is what both native routes
 * use. If the route ever changes shape the guard fails closed — an unknown
 * order id is refused rather than waved through.
 */
export const requireShipGate = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const orderId = req.params.id

      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Objednávku nelze ověřit, proto ji zatím nelze odeslat."
        )
      }

      const input = await loadShipGateInput(req.scope, orderId)

      if (!input) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "Objednávka nebyla nalezena."
        )
      }

      const verdict = evaluateShipGate(input)

      if (!verdict.allowed) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          verdict.reason ?? "Objednávku zatím nelze odeslat."
        )
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
