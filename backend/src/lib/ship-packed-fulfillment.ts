import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmMerchantHandoverWorkflow } from "../workflows/confirm-merchant-handover"

/**
 * Po „Označit jako odeslané" odešle i nativní zásilku — ale JEN tu, která už
 * je zabalená (štítek → otevřený fulfillment). Bez toho nativní detail
 * objednávky dál ukazoval „Čeká na odeslání" (14. 10. 2026).
 *
 * Nový fulfillment ani štítek se tu NEVYTVÁŘÍ (přání majitelky 7. 10. 2026:
 * „Odesláno" je lehká akce); bez otevřeného fulfillmentu workflow nic neudělá.
 * E-mail „odesláno" nepřijde dvakrát — `shipment.created` i změna fáze sdílí
 * klíč `ship:${order.id}`. U dobírky `shipment.created` vystaví fakturu při
 * předání (subscriber idoklad-invoice), stejně jako když zásilku odešle sledování.
 *
 * Nikdy nevyhazuje: fáze už je „Odesláno", nativní zásilka jde dohnat ručně.
 */
export const shipPackedFulfillment = async (
  container: MedusaContainer,
  orderId: string,
  createdBy: string | null
): Promise<void> => {
  try {
    await confirmMerchantHandoverWorkflow(container).run({
      input: { order_id: orderId, created_by: createdBy },
    })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[objednávky] ${orderId}: nativní zásilka po „Odesláno" nevznikla — ${(error as Error)?.message}`
      )
  }
}
