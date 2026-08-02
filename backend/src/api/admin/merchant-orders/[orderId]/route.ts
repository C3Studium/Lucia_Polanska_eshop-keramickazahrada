import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import MerchantOrderModuleService from "../../../../modules/merchant-order/service"
import {
  MerchantOrderStage,
  transitionMerchantOrderWorkflow,
} from "../../../../workflows/transition-merchant-order"

const stages = new Set<MerchantOrderStage>([
  "received",
  "working",
  "shipping",
  "shipped",
  "payment_problem",
  "cancelled",
])

const load = async (req: MedusaRequest) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const states = await service.listMerchantOrderStates({ order_id: req.params.orderId })
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "*",
      "items.*",
      "items.metadata",
      "shipping_address.*",
      "billing_address.*",
      "shipping_methods.*",
      "payment_collections.*",
      "payment_collections.payments.*",
      "fulfillments.*",
      "production_order.*",
      "production_order.payment_requests.*",
    ],
    filters: { id: req.params.orderId },
  })
  return { state: states[0] || null, order: orders[0] || null }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await load(req)
  if (!result.order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  res.status(200).json({ order: result })
}

export const PATCH = async (
  req: MedusaRequest<{
    stage: MerchantOrderStage
    internal_note?: string | null
    attention_reason?: string | null
  }>,
  res: MedusaResponse
) => {
  if (!stages.has(req.body.stage)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatný stav objednávky.")
  }
  const { result } = await transitionMerchantOrderWorkflow(req.scope).run({
    input: {
      order_id: req.params.orderId,
      stage: req.body.stage,
      changed_by: (req as any).auth_context?.actor_id || null,
      internal_note: req.body.internal_note,
      attention_reason: req.body.attention_reason,
    },
  })
  res.status(200).json({ order: result })
}
