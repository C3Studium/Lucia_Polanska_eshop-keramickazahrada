import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { markClearanceSold } from "../lib/clearance-lifecycle"

/**
 * Poškozený kus po objednávce HNED pryč z obchodu — měkce: koncept,
 * Archivované, pryč z akcí, rezervace v košíku zahozena. Smaže se až po
 * odeslání (`clearance-settle`), po zrušení objednávky se vrátí.
 * Podrobně `lib/clearance-lifecycle.ts` (18. 11. 2026).
 */
export default async function clearanceSoldOut({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = event.data?.id
  if (!orderId) return

  try {
    await markClearanceSold(container, orderId)
  } catch (error) {
    logger.warn(
      `[clearance] Schování prodaného poškozeného kusu se nepovedlo (dožene hodinová úloha): ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "clearance-sold-out" },
}
