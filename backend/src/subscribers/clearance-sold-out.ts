import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { retireSoldOutClearance } from "../jobs/retire-sold-out-clearance"

/**
 * Poškozený kus po prodeji HNED pryč z obchodu (18. 11. 2026, přání
 * majitele: „až se vyprodá, ať se hned schová a sleva zruší").
 *
 * Úloha `retire-sold-out-clearance` běží jen jednou za hodinu, takže
 * prodaný kus mohl skoro hodinu viset v obchodě jako „Prodáno" a dál
 * v akcích. Tady se tatáž úloha spustí hned po objednávce, která poškozený
 * kus obsahuje: kus se přepne na koncept (zmizí z webu), přesune do
 * Archivovaných a vypadne ze všech akcí. Hodinová úloha zůstává jako
 * pojistka (např. kus vyprodaný ručně ve Skladu).
 */
export default async function clearanceSoldOut({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = event.data?.id
  if (!orderId) return

  try {
    const { data } = (await query.graph({
      entity: "order",
      fields: ["id", "items.product_id", "items.product.metadata"],
      filters: { id: orderId },
    })) as { data: any[] }
    const obsahujePoskozeny = (data[0]?.items ?? []).some(
      (item: any) => item?.product?.metadata?.clearance === true
    )
    if (!obsahujePoskozeny) return
    await retireSoldOutClearance(container)
  } catch (error) {
    logger.warn(
      `[clearance] Okamžité schování prodaného poškozeného kusu se nepovedlo (dožene hodinová úloha): ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "clearance-sold-out" },
}
