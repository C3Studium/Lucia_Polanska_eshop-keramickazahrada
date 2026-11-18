import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { settleSoldClearance } from "../lib/clearance-lifecycle"

/**
 * Prodaný poškozený kus: po odeslání / výdeji smazat i se slevou, po zrušení
 * objednávky vrátit do obchodu (`lib/clearance-lifecycle.ts`). Prodaných kusů
 * čekajících na odeslání je pár, takže se při každé takové události projdou
 * všechny — jednodušší a spolehlivější než hledat, kterého se týká.
 */
export default async function clearanceSettle({ event, container }: SubscriberArgs<unknown>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await settleSoldClearance(container)
  } catch (error) {
    logger.warn(
      `[clearance] Dořešení prodaného kusu po ${event.name} se nepovedlo (dožene hodinová úloha): ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["shipment.created", "delivery.created", "order.completed", "order.canceled"],
  context: { subscriberId: "clearance-settle" },
}
