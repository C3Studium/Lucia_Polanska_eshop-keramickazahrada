import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ohlasKontroly, spustKontroly } from "../lib/provozni-hlidka"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Provozní hlídka — běh každých patnáct minut (3. 11. 2026).
 *
 * Projde kontroly a ke každé rozbité pošle e-mail na vývojářskou adresu.
 * Klíč alarmu nese den, takže jedna rozbitá věc píše jednou denně, ne
 * devadesátšestkrát — Resend dává sto e-mailů denně a vyčerpaný limit by
 * znamenal, že zákazník nedostane ani potvrzení objednávky.
 *
 * Čtvrthodina je kompromis: kratší interval by u věcí s dvouhodinovou
 * lhůtou (zachycení platby) nic nepřidal, delší by znamenal, že se o
 * rozbité fakturaci dozvíme po obědě.
 */
async function watchProvoz(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const vysledky = await spustKontroly(container)
  const chyby = vysledky.filter((vysledek) => vysledek.stav === "chyba")

  if (!chyby.length) {
    logger.info(`[provoz] ${vysledky.length} kontrol, vše v pořádku`)
    return
  }

  const posláno = await ohlasKontroly(container, vysledky)

  logger.warn(
    `[provoz] nefunguje: ${chyby
      .map((chyba) => chyba.nazev)
      .join(", ")} — alarmů k odeslání: ${posláno}`
  )
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc hned e-mailem. */
export default sUlohou("watch-provoz", watchProvoz)

export const config = {
  name: "watch-provoz",
  schedule: "*/15 * * * *",
}
