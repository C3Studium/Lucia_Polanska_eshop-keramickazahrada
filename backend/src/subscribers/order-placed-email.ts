import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isCommissionCheckoutOrder } from "../lib/potvrzeni-zakazky/fields"
import { buildOrderConfirmation } from "../lib/potvrzeni-zakazky"
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

  /*
   * Klasická kupní smlouva (§ 1827 odst. 2 OZ) k běžnému zboží.
   *
   * Zakázka má vlastní PDF a posílá ho `commission-confirmation`; sem
   * dojdou objednávky bez zakázkové položky, a ty potřebují potvrzení
   * smlouvy stejně. Dokud tohle nebylo, nesl potvrzení jen e-mail —
   * s obchodními podmínkami a poučením, ale bez dokumentu, který shrnuje,
   * co bylo sjednáno.
   *
   * Selhání PDF potvrzení NEZASTAVÍ: zákazník nesmí zůstat bez e-mailu
   * kvůli příloze. Chyba se zaloguje a potvrzení odejde bez ní.
   */
  let confirmation: { filename: string; url: string } | null = null
  try {
    const built = await buildOrderConfirmation(container, data.id)
    confirmation = built.attachment
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[potvrzení objednávky] PDF k objednávce ${data.id} se nepodařilo vytvořit: ${
          error instanceof Error ? error.message : String(error)
        } — potvrzení objednávky odchází bez něj.`
      )
  }

  await sendOrderConfirmationWorkflow(container).run({
    input: {
      id: data.id,
      ...(confirmation ? { commission_confirmations: [confirmation] } : {}),
    },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
