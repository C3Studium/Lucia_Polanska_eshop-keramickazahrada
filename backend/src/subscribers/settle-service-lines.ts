import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { settleServiceLines } from "../lib/service-lines-settle"

/**
 * Po odeslání zboží zapíše balné a doběrečné jako vyskladněné a odeslané
 * (`lib/service-lines-settle.ts` — proč bez plnění u dopravce).
 *
 * Bez toho zůstala každá objednávka s balným v nativním záhlaví napořád
 * „Částečně splněno" a balné viselo v „Nesplněných položkách" (#50).
 *
 * `shipment.created` nese id plnění; objednávku k němu najde link. Zápis jde
 * přímo do modulu objednávek, takže sám žádné `shipment.created` nevyvolá —
 * nezacyklí se. Chyba se jen zaloguje: odeslání zboží už proběhlo a tenhle
 * doplněk ho nesmí shodit.
 */
export default async function settleServiceLinesHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "order.id"],
      filters: { id: data.id },
    })
    const orderId = (fulfillments[0] as any)?.order?.id as string | undefined
    if (!orderId) return

    const result = await settleServiceLines(container, orderId)
    if (result.fulfilled || result.shipped) {
      logger.info(
        `[balné] Objednávka ${orderId}: servisní řádky zapsány jako vyskladněné (${result.fulfilled}) a odeslané (${result.shipped}).`
      )
    }
  } catch (error) {
    logger.warn(
      `[balné] Servisní řádky k plnění ${data.id} se nepodařilo zapsat: ${
        (error as Error)?.message ?? String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "shipment.created",
}
