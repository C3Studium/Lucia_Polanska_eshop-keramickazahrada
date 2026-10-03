import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

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
  const surcharge = toNumber(productionOrder.surcharge)
  // Příplatek navyšuje, co se má doplatit — cenu samotnou nemění.
  const finalTotal =
    toNumber(productionOrder.agreed_total ?? productionOrder.original_total) +
    surcharge
  const outstandingAmount = Math.max(0, finalTotal - paidAmount)
  const canFulfill =
    ["ready_to_ship", "completed"].includes(productionOrder.stage) &&
    outstandingAmount <= 0.005

  // Fotky a text, které zákazník poslal k zakázce (metadata položek objednávky).
  // Zobrazí je admin vedle zákazníka. Brief leží na řádku jako made_to_order.
  const customerPhotos: string[] = []
  let customerSpecification: string | null = null
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "items.metadata"],
      filters: { id: req.params.orderId },
    })
    for (const item of ((orders[0] as any)?.items ?? []) as any[]) {
      const mto = (item?.metadata as any)?.made_to_order
      if (!mto || typeof mto !== "object") continue
      if (Array.isArray(mto.photos)) {
        for (const url of mto.photos) {
          if (typeof url === "string" && url) customerPhotos.push(url)
        }
      }
      const spec =
        typeof mto.specification === "string"
          ? mto.specification
          : typeof mto.note === "string"
          ? mto.note
          : null
      if (spec && spec.trim() && !customerSpecification) {
        customerSpecification = spec.trim()
      }
    }
  } catch {
    // Fotky jsou doplněk — když se nenačtou, zbytek projekce stojí dál.
  }

  res.status(200).json({
    production_order: {
      ...productionOrder,
      surcharge,
      final_total: finalTotal,
      payment_requests: payments,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      can_fulfill: canFulfill,
      customer_photos: customerPhotos,
      customer_specification:
        customerSpecification ?? productionOrder.customer_note ?? null,
    },
  })
}

