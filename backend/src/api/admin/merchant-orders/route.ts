import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_MODULE } from "../../../modules/merchant-order"
import MerchantOrderModuleService from "../../../modules/merchant-order/service"

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const stage = typeof req.query.stage === "string" ? req.query.stage : undefined
  const filters = stage ? { stage } : {}
  const [states, count] = await service.listAndCountMerchantOrderStates(filters as any, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })
  const orderIds = states.map((state: any) => state.order_id)
  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "created_at",
          "email",
          "currency_code",
          "total",
          "payment_status",
          "fulfillment_status",
          "items.id",
          "items.title",
          "items.quantity",
          "items.thumbnail",
          "items.variant_title",
          "items.metadata",
          "shipping_methods.*",
        ],
        filters: { id: orderIds },
      })
    : { data: [] }
  const byId = new Map(orders.map((order: any) => [order.id, order]))
  const result = states.map((state: any) => ({
    ...state,
    order: byId.get(state.order_id) || null,
  }))

  const allStates = await service.listMerchantOrderStates({})
  const summary = allStates.reduce((acc: Record<string, number>, item: any) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1
    return acc
  }, {})

  res.status(200).json({ orders: result, count, limit, offset, summary })
}

