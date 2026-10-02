import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sweepUrovne } from "../lib/inventory-levels"

/**
 * Při startu srovná celý sklad: každé skladové položce bez úrovně doplní nulu.
 *
 * ## Proč loader, a ne jen skript v predeploy
 *
 * `scripts/backfill-inventory-levels.ts` existuje a je i v `predeploy` —
 * jenže ten se na Railway nespustil (deploy jede `start`, ne `predeploy`),
 * takže na živé DB zůstalo 121 z 264 položek bez úrovně a skoro půlka katalogu
 * nešla koupit (padalo to na „is not stocked at location" při dokončení
 * košíku). Loader běží při každém startu backendu, takže náprava přijde
 * s obyčejným nasazením nebo restartem — bez ručního `medusa exec`, který
 * v tomhle provozu nikdo spolehlivě nespouští.
 *
 * ## Proč je to bezpečné opakovat
 *
 * `sweepUrovne` je idempotentní: položka, která úroveň má, se nedotkne, a nula
 * nic nepřidává ani neubírá (viz `lib/inventory-levels.ts`). Běh přes 264
 * položek jsou jednotky dotazů; cena startu je zanedbatelná.
 *
 * ## Proč nikdy neshodí start
 *
 * Doplnění zásob je doplněk, ne podmínka běhu obchodu. Když selže (krátký
 * výpadek modulu, víc skladů), jen se to zaloguje — pojistka na dokončení
 * košíku (`lib/require-stockable-cart.ts`) chybějící úroveň stejně doplní za
 * běhu, těsně před rezervací.
 */
export default async function backfillInventoryLevelsLoader(
  container: MedusaContainer
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const { zalozeno, proslo, locationId } = await sweepUrovne(container)

    if (!locationId) {
      logger.warn(
        "[sklad] Start: úrovně se nedoplnily — obchod nemá právě jedno skladové místo."
      )
      return
    }

    if (zalozeno) {
      logger.info(
        `[sklad] Start: ${zalozeno} z ${proslo} skladových položek dostalo chybějící úroveň zásoby (0 ks).`
      )
    }
  } catch (error) {
    logger.warn(
      `[sklad] Start: doplnění úrovní zásob selhalo, pokračuji: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}
