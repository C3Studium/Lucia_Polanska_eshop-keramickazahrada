import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../modules/merchant-order"
import MerchantOrderModuleService from "../modules/merchant-order/service"

export type MerchantOrderStage =
  | "received"
  | "working"
  | "shipping"
  | "shipped"
  | "payment_problem"
  | "cancelled"

type TransitionMerchantOrderInput = {
  order_id: string
  stage: MerchantOrderStage
  changed_by?: string | null
  internal_note?: string | null
  attention_reason?: string | null
}

const allowedTransitions: Record<MerchantOrderStage, MerchantOrderStage[]> = {
  received: ["working", "payment_problem", "cancelled"],
  working: ["shipping", "payment_problem", "cancelled"],
  shipping: ["shipped", "payment_problem", "cancelled"],
  shipped: [],
  payment_problem: ["received", "working", "cancelled"],
  cancelled: [],
}

const updateMerchantOrderStateStep = createStep(
  "transition-merchant-order-state",
  async (input: TransitionMerchantOrderInput, { container }) => {
    const service = container.resolve<MerchantOrderModuleService>(
      MERCHANT_ORDER_MODULE
    )
    const states = await service.listMerchantOrderStates({ order_id: input.order_id })
    const current = states[0]
    const previousStage: MerchantOrderStage =
      (current?.stage as MerchantOrderStage) || "received"

    if (previousStage !== input.stage) {
      const allowed = allowedTransitions[previousStage] || []
      if (!allowed.includes(input.stage)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Objednávku nelze přesunout ze stavu ${previousStage} do stavu ${input.stage}.`
        )
      }
    }

    const payload = {
      stage: input.stage,
      stage_changed_at: new Date(),
      stage_changed_by: input.changed_by || null,
      internal_note: input.internal_note ?? current?.internal_note ?? null,
      requires_attention: input.stage === "payment_problem",
      attention_reason:
        input.stage === "payment_problem"
          ? input.attention_reason || "Platba vyžaduje kontrolu."
          : null,
    }
    const updated = current
      ? await service.updateMerchantOrderStates({ id: current.id, ...payload })
      : await service.createMerchantOrderStates({
          order_id: input.order_id,
          ...payload,
        })

    return new StepResponse(updated, current || null)
  },
  async (previous: any, { container }) => {
    if (!previous?.id) return
    const service = container.resolve<MerchantOrderModuleService>(
      MERCHANT_ORDER_MODULE
    )
    await service.updateMerchantOrderStates(previous)
  }
)

export const transitionMerchantOrderWorkflow = createWorkflow(
  "transition-merchant-order",
  (input: TransitionMerchantOrderInput) => {
    const lockKey = transform(input, ({ order_id }) => `merchant-order:${order_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 60 })
    const state = updateMerchantOrderStateStep(input)
    emitEventStep({
      eventName: "merchant-order.stage-changed",
      data: transform({ input, state }, ({ input, state }) => ({
        order_id: input.order_id,
        state_id: state.id,
        stage: state.stage,
      })),
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(state)
  }
)

