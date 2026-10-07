import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import MerchantOrderModuleService from "../../../../modules/merchant-order/service"
import { isMerchantOrderStage } from "../../../../modules/merchant-order/stages"
import type { MerchantOrderStage } from "../../../../modules/merchant-order/stages"
import { completePersonalPickupWorkflow } from "../../../../workflows/complete-personal-pickup"
import { confirmMerchantHandoverWorkflow } from "../../../../workflows/confirm-merchant-handover"
import { transitionMerchantOrderWorkflow } from "../../../../workflows/transition-merchant-order"
import { evaluateShipGate } from "../../../../lib/ship-gate"
import { loadShipGateInput } from "../../../../lib/require-ship-gate"
import { toMerchantOrderRow } from "../projection"

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  "total",
  "items.*",
  "summary.*",
  "shipping_methods.*",
  "shipping_address.*",
  "billing_address.*",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.*",
  "payment_collections.payments.*",
  "fulfillments.*",
]

const load = async (req: MedusaRequest) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const states = await service.listMerchantOrderStates({
    order_id: req.params.orderId,
  })

  // `getOrderDetailWorkflow` is the only supported source of `payment_status` and
  // `fulfillment_status`; they are computed there, not stored on the order.
  const { result: order } = await getOrderDetailWorkflow(req.scope).run({
    input: { order_id: req.params.orderId, fields: ORDER_FIELDS },
  })

  // Read-only links are uni-directional, so the production order has to be the entity
  // we query from — `order -> production_order` is not a traversable direction.
  const { data: productionOrders } = await query.graph({
    entity: "production_order",
    fields: ["*", "payment_requests.*"],
    filters: { order_id: req.params.orderId },
  })

  const { data: orderChanges } = await query.graph({
    entity: "order_change",
    fields: ["id", "status"],
    filters: { order_id: req.params.orderId },
  })

  return {
    state: states[0] || null,
    order: order || null,
    production_order: productionOrders[0] || null,
    order_changes: orderChanges || [],
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { state, order, production_order, order_changes } = await load(req)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }
  res.status(200).json({
    merchant_order: state
      ? toMerchantOrderRow(state, order, production_order, order_changes)
      : null,
    order,
    production_order,
  })
}

export const PATCH = async (
  req: MedusaRequest<{
    stage: MerchantOrderStage | "handover_confirmed" | "pickup_collected"
    internal_note?: string | null
    attention_reason?: string | null
  }>,
  res: MedusaResponse
) => {
  const customVerbs = ["handover_confirmed", "pickup_collected"]
  if (!customVerbs.includes(req.body.stage) && !isMerchantOrderStage(req.body.stage)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Neplatný stav objednávky.")
  }

  const changedBy = (req as any).auth_context?.actor_id || null

  // „Vyzvednuto a zaplaceno" — personal collection: cash and goods change
  // hands at the same moment, so one action records both.
  if (req.body.stage === "pickup_collected") {
    await completePersonalPickupWorkflow(req.scope).run({
      input: { order_id: req.params.orderId, created_by: changedBy },
    })
    res.status(200).json({ collected: true })
    return
  }

  // „Zásilku jsem předala dopravci" — phase two of A1. A separate verb from
  // the ordinary stage move, because it asserts a fact about the physical
  // world rather than requesting a workflow step.
  if (req.body.stage === "handover_confirmed") {
    const { result } = await confirmMerchantHandoverWorkflow(req.scope).run({
      input: { order_id: req.params.orderId, created_by: changedBy },
    })

    if (!(result as any)?.canConfirm) {
      // Not an error: a second confirmation, or a parcel that already left.
      res.status(200).json({
        confirmed: false,
        message: "Tato zásilka už je předaná dopravci.",
      })
      return
    }

    res.status(200).json({ confirmed: true })
    return
  }

  // „Označit jako odeslané" = JEN stav + e-mail zákazníkovi (přání majitelky
  // 7. 10. 2026). Štítek (ČP podání) i případná Medusa zásilka jsou samostatné
  // akce — tohle objednávku NEfulfilluje ani negeneruje štítek, jen ji posune
  // na „Odesláno". E-mail „odesláno" pošle subscriber na změnu fáze.
  //
  // Pojistka A2 ale zůstává: nezaplacenou zásilku (zakázka s nedoplaceným
  // doplatkem) takhle označit nejde — jinak by šlo odeslat neuhrazené zboží.
  if (req.body.stage === "shipped") {
    const gateInput = await loadShipGateInput(req.scope, req.params.orderId)
    const verdict = gateInput
      ? evaluateShipGate(gateInput)
      : { allowed: true, reason: null }
    if (!verdict.allowed) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        verdict.reason || "Objednávku zatím nelze označit za odeslanou."
      )
    }
    // Projde dál na obecný přechod fáze (transitionMerchantOrderWorkflow níž).
  }

  const { result } = await transitionMerchantOrderWorkflow(req.scope).run({
    input: {
      order_id: req.params.orderId,
      stage: req.body.stage,
      changed_by: changedBy,
      internal_note: req.body.internal_note,
      attention_reason: req.body.attention_reason,
    },
  })
  res.status(200).json({ merchant_order_state: result })
}
