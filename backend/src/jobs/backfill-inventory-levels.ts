import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sweepUrovne } from "../lib/inventory-levels"

/**
 * Pravidelně srovná sklad: každé skladové položce bez úrovně doplní nulu.
 *
 * ## Proč job, a ne loader
 *
 * `src/loaders` v Meduse v2 při startu aplikace neběží — loadery jsou pojem
 * modulu, ne projektu (ověřeno: nasazený loader se nespustil, zůstalo 121 z 264
 * položek bez úrovně). Naplánovaná úloha je naopak první třída a běží
 * spolehlivě. `scripts/backfill-inventory-levels.ts` je v `predeploy`, jenže
 * ten se na Railway nespouští — tenhle job to zastává za běhu.
 *
 * ## Co řeší
 *
 * Prodej bez skladu (`allow_backorder`) sám nestačí: Medusa při dokončení
 * košíku zakládá rezervaci a položka bez `inventory_level` ji shodí na „is not
 * stocked at location". Nula je bezpečná — dostupnost zůstává 0, jen vznikne
 * místo, kam rezervace dosedne a odkud smí stav klesnout do minusu. Celé
 * zdůvodnění je v `lib/inventory-levels.ts`.
 *
 * Reálnou jistotu u KAŽDÉHO nákupu dává pojistka na dokončení košíku
 * (`lib/require-stockable-cart.ts`); tenhle job jen drží katalog srovnaný, aby
 * dostupnost a admin seděly i u kusů, které se zatím neprodaly — hlavně po
 * hromadném importu, který subscriber variant obejde.
 *
 * Idempotentní: položka, která úroveň má, nevyvolá žádný zápis.
 */
export default async function backfillInventoryLevelsJob(
  container: MedusaContainer
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const { zalozeno, proslo, locationId } = await sweepUrovne(container)

    if (!locationId) {
      logger.warn(
        "[sklad] Sweep přeskočen — obchod nemá právě jedno skladové místo."
      )
      return
    }

    if (zalozeno) {
      logger.info(
        `[sklad] Sweep: ${zalozeno} z ${proslo} skladových položek dostalo chybějící úroveň zásoby (0 ks).`
      )
    }
  } catch (error) {
    logger.warn(
      `[sklad] Sweep úrovní zásob selhal, zkusí se znovu příště: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config = {
  name: "backfill-inventory-levels",
  // Každé dvě hodiny. Běžné nové varianty řeší subscriber hned; tohle je
  // záchytná síť po importech a cokoliv, co subscriber minul. Offset mimo celou
  // hodinu, ať se to netluče s ostatními úlohami.
  schedule: "15 */2 * * *",
}
