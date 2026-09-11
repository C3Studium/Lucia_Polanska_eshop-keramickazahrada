import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sweepUrovne } from "../lib/inventory-levels"

/**
 * Doplní chybějící úrovně zásob celému skladu.
 *
 * Proč to je potřeba a proč je nula bezpečná, stojí v `lib/inventory-levels.ts`.
 * Ve zkratce: bez úrovně nemá Medusa kam zapsat rezervaci a objednávka
 * s takovým kusem spadne na „is not stocked at location" — naměřeno 121 z 263
 * skladových položek, všechny z importu 17. 8. 2026.
 *
 * Odběratel (`subscribers/default-inventory-level.ts`) drží stav u nově
 * vznikajících variant; tohle je ta první jízda nad skladem, který ho nikdy
 * neviděl.
 *
 * Spuštění:  npx medusa exec ./src/scripts/backfill-inventory-levels.ts
 * Opakovatelné — položka, která úroveň má, se nedotkne.
 */
export default async function backfillInventoryLevels({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { zalozeno, proslo, locationId } = await sweepUrovne(container)

  if (!locationId) {
    logger.warn(
      "[sklad] Přeskočeno — obchod nemá právě jedno skladové místo, takže není kam nulu doplnit."
    )
    return
  }

  logger.info(
    `[sklad] Prošlo ${proslo} skladových položek, ${zalozeno} jich dostalo úroveň zásoby (0 ks) na ${locationId}.`
  )
}
