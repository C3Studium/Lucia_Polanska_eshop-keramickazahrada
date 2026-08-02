import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MADE_TO_ORDER_MODULE } from "../../../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../../../modules/made-to-order/service"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Number(source.value ?? source.numeric_ ?? source.raw ?? 0)
  }
  return Number(value ?? 0)
}

/**
 * Merchant-facing projection of a made-to-order order. Medusa's native order
 * and payment collections remain the source of truth; this record only keeps
 * the production lifecycle and immutable deposit/balance snapshots.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const productionOrders = await service.listProductionOrders({
    order_id: req.params.orderId,
  })
  const productionOrder = productionOrders[0]

  // A normal order isn't an error. Returning null lets the order-detail widget
  // stay mounted for all orders without producing a noisy 404 request.
  if (!productionOrder) {
    return res.status(200).json({ production_order: null })
  }

  const payments = await service.listProductionPaymentRequests(
    { production_order_id: productionOrder.id } as any,
    { order: { created_at: "ASC" } }
  )
  const paidAmount = payments
    .filter((payment: any) => payment.status === "paid")
    .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
  const finalTotal = toNumber(
    productionOrder.agreed_total ?? productionOrder.original_total
  )
  const outstandingAmount = Math.max(0, finalTotal - paidAmount)
  const canFulfill =
    ["ready_to_ship", "completed"].includes(productionOrder.stage) &&
    outstandingAmount <= 0.005

  res.status(200).json({
    production_order: {
      ...productionOrder,
      payment_requests: payments,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      can_fulfill: canFulfill,
    },
  })
}

