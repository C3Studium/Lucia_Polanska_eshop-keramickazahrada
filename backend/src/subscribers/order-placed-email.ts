import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isCommissionCheckoutOrder } from "../lib/potvrzeni-zakazky/fields"
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation"

/**
 * Potvrzení objednávky. Objednávka se zakázkou (kolekce z pokladny nese
 * `made_to_order` + `production_lines` — stejná podmínka, za které
 * `initialize-merchant-order` zakládá produkční objednávku) ho NEdostane
 * odsud: posílá ho `commission-confirmation` po eventu
 * `made-to-order.production-order-created`, i s PDF Potvrzení zakázky (Z11).
 * Jinak by potvrzení odešlo dřív, než zakázka vůbec vznikne.
 *
 * Když se objednávka nedá přečíst, potvrzení jde rovnou — bez něj zákazník
 * zůstat nesmí.
 */
export default async function orderPlacedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "payment_collections.metadata"],
      filters: { id: data.id },
    })
    const order = orders?.[0] as any
    if (order && isCommissionCheckoutOrder(order)) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(
          `[order-placed] Objednávka #${order.display_id} je zakázka — potvrzení pošle commission-confirmation s PDF Potvrzení zakázky.`
        )
      return
    }
  } catch {
    // Nešlo rozhodnout — radši potvrzení poslat hned než vůbec.
  }

  await sendOrderConfirmationWorkflow(container)
    .run({
      input: {
        id: data.id
      }
    })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
