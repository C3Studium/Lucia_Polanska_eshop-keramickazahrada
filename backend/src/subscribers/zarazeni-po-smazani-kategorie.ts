import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { srovnejZarazeni } from "../lib/zarazeni-hlidka"

/**
 * Smazaná kategorie: Medusa ji jen označí smazanou a vazby výrobků na ni
 * nechá (audit 19. 11. 2026 jich našel 74). Hned je uklidit —
 * `lib/zarazeni-hlidka.ts`.
 */
export default async function zarazeniPoSmazaniKategorie({ container }: SubscriberArgs<unknown>) {
  try {
    await srovnejZarazeni(container)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[zařazení] Úklid po smazání kategorie se nepovedl (dožene hodinová úloha): ${String((error as Error)?.message ?? error)}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product-category.deleted"],
  context: { subscriberId: "zarazeni-po-smazani-kategorie" },
}
