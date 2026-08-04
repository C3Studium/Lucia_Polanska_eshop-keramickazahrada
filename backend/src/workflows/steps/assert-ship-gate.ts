import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"
import { evaluateShipGate, type ShipGateInput } from "../../lib/ship-gate"

/**
 * Refuses to dispatch an order that is not paid for (WorkflowPlan.md A2).
 *
 * The rules themselves live in `src/lib/ship-gate.ts`, shared with the
 * middleware that guards the native fulfilment route — this step only turns a
 * verdict into a workflow failure.
 *
 * It runs **first**, before anything native is touched, so a blocked order has
 * nothing to compensate: no fulfilment, no inventory movement, no stage change.
 * The message is the Czech one from the verdict, because it is shown to the
 * merchant verbatim on the card.
 */
export const assertShipGateStep = createStep(
  "assert-ship-gate",
  async (input: ShipGateInput) => {
    const verdict = evaluateShipGate(input)

    if (!verdict.allowed) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        verdict.reason ?? "Objednávku zatím nelze odeslat."
      )
    }
  }
)
