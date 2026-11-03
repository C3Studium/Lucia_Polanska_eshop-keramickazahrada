import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sweepDiscountable } from "../lib/discountable"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Denní srovnání: kdo je zlevněný, ten slevový kód nedostane.
 *
 * ## Proč to nestačí řešit odběratelem
 *
 * `subscribers/sync-discountable.ts` reaguje na zápis do produktu, a tím se
 * pokryje Výprodej. Sezónní akce ale začíná a končí **datem**: v den, kdy
 * ceník doběhne, se nikam nezapisuje a žádná událost nepřijde. Bez tohohle
 * přejezdu by kusy po skončení akce zůstaly natrvalo označené jako zlevněné
 * a slevový kód by na ně nešel — tiše a bez stopy.
 *
 * Běží nad ránem, po `close-finished-sales`, aby už četl svět po zavření
 * doběhlých akcí.
 */
async function syncDiscountableDaily(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { zapnuto, vypnuto, proslo } = await sweepDiscountable(container)

  if (zapnuto || vypnuto) {
    logger.info(
      `[discountable] Přejezd katalogu: ${proslo} produktů, ` +
        `${vypnuto} nově bez nároku na slevový kód, ${zapnuto} zpět s nárokem.`
    )
  }
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc hned e-mailem. */
export default sUlohou("sync-discountable", syncDiscountableDaily)

export const config = {
  name: "sync-discountable",
  schedule: "30 1 * * *",
}
