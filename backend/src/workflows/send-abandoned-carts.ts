import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { sendAbandonedNotificationsStep } from "./steps/send-abandoned-notifications"
import { updateCartsStep } from "@medusajs/medusa/core-flows"
import { CartDTO } from "@medusajs/framework/types"
import { CustomerDTO } from "@medusajs/framework/types"

export type SendAbandonedCartsWorkflowInput = {
  carts: (CartDTO & {
    customer: CustomerDTO
  })[]
}

export const sendAbandonedCartsWorkflow = createWorkflow(
  "send-abandoned-carts",
  function(input: SendAbandonedCartsWorkflowInput) {
    const vysledek = sendAbandonedNotificationsStep(input)

    /*
     * Příznak dostanou jen košíky, které krok opravdu vyřídil.
     *
     * Dřív se razítkovaly všechny košíky, které do kroku vstoupily — jenže krok
     * padal na první neodeslaný e-mail, takže se `updateCartsStep` nespustil
     * vůbec a nerazítkoval se ani jeden. Výsledek: každou noc se rozesílalo
     * všem 317 košíkům znovu.
     *
     * Košíky s přechodnou chybou se schválně nerazítkují — ty se mají zkusit
     * zítra znovu.
     */
    const updateCartsData = transform(
      { input, vysledek },
      (data) => {
        const vyrizene = new Set(data.vysledek.vyrizeneKosiky)

        return data.input.carts
          .filter((cart) => vyrizene.has(cart.id))
          .map((cart) => ({
            id: cart.id,
            metadata: {
              ...cart.metadata,
              abandoned_notification: new Date().toISOString()
            }
          }))
      }
    )

    const updatedCarts = updateCartsStep(updateCartsData)

    return new WorkflowResponse(updatedCarts)
  }
)
