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
import {
  MERCHANT_ORDER_STAGE_TRANSITIONS,
  type MerchantOrderStage,
} from "../modules/merchant-order/stages"

export type { MerchantOrderStage }

type TransitionMerchantOrderInput = {
  order_id: string
  stage: MerchantOrderStage
  changed_by?: string | null
  internal_note?: string | null
  attention_reason?: string | null
  /**
   * Set when the transition mirrors something Medusa has already done (a fulfilment was
   * created, a payment was captured) rather than something the merchant chose.
   *
   * The transition table encodes what the merchant is *allowed* to click. Reality is not
   * bound by it: if a shipment is cancelled natively, the queue has to follow even though
   * `shipped` has no outgoing merchant transitions. Reconciliation therefore skips the
   * guard — it is reporting a fact, not requesting a change.
   */
  reconcile?: boolean
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

    // Nothing to do — keeps event-driven reconciliation idempotent under at-least-once
    // delivery instead of writing a new `stage_changed_at` on every redelivery.
    if (current && previousStage === input.stage) {
      return new StepResponse(current, null)
    }

    if (!input.reconcile) {
      const allowed = MERCHANT_ORDER_STAGE_TRANSITIONS[previousStage] || []
      if (!allowed.includes(input.stage)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Objednávku nelze přesunout ze stavu ${previousStage} do stavu ${input.stage}.`
        )
      }
    }

    // Appended, never rewritten. The reconcile flag is recorded so the
    // timeline can distinguish "she moved it" from "reality moved it".
    const history = [
      ...(Array.isArray(current?.stage_history) ? current.stage_history : []),
      {
        from: current ? previousStage : null,
        to: input.stage,
        at: new Date().toISOString(),
        by: input.changed_by || null,
        note: input.internal_note || null,
        reconciled: Boolean(input.reconcile),
      },
    ]

    const payload = {
      stage: input.stage,
      stage_changed_at: new Date(),
      stage_changed_by: input.changed_by || null,
      stage_history: history,
      internal_note: input.internal_note ?? current?.internal_note ?? null,
      requires_attention: input.stage === "payment_problem",
      attention_reason:
        input.stage === "payment_problem"
          ? input.attention_reason || "Platba vyžaduje kontrolu."
          : null,
    }
    const updated = current
      ? await service.updateMerchantOrderStates({
          id: current.id,
          ...payload,
        } as never)
      : await service.createMerchantOrderStates({
          order_id: input.order_id,
          ...payload,
        } as never)

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

