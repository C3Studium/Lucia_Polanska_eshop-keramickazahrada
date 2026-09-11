import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sweepDiscountable } from "../lib/discountable"

/**
 * Srovná celý katalog s pravidlem „na zlevněný kus slevový kód neplatí".
 *
 * Pravidlo samo i důvody bydlí v `lib/discountable.ts`; tenhle skript je jen
 * způsob, jak ho vyvolat ručně nebo při nasazení. Odběratel
 * (`subscribers/sync-discountable.ts`) drží stav u nových a měněných produktů,
 * denní job (`jobs/sync-discountable.ts`) chytá doběhnuté sezónní akce — tohle
 * je ta první jízda nad katalogem, který obojí nikdy nevidělo.
 *
 * Spuštění:  npx medusa exec ./src/scripts/sync-discountable.ts
 * Opakovatelné — už správně nastavený produkt se nezapisuje.
 */
export default async function syncDiscountable({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { zapnuto, vypnuto, proslo } = await sweepDiscountable(container)

  logger.info(
    `[discountable] Prošlo ${proslo} produktů. ` +
      `${vypnuto} zlevněných už slevový kód nepřijme, ` +
      `${zapnuto} se vrátilo k plné ceně a kód na ně zase platí.`
  )
}
