import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ohlasHned } from "./index"
import { zapisProvoz } from "./zapis"

/**
 * Obal úlohy na pozadí (3. 11. 2026).
 *
 * ## Proč
 *
 * Když spadne úloha, Medusa to zaloguje a tím to skončí. Log na Railway nikdo
 * nečte průběžně, takže smiřovací běh plateb může být týden mrtvý a pozná se
 * to podle toho, že chybí peníze — ne podle toho, že spadl.
 *
 * Obal dělá tři věci: zapíše každý běh do deníku (takže je v denním souhrnu
 * vidět, že úlohy vůbec jedou), při pádu pošle hned e-mail s textem výjimky
 * a stopou, a výjimku pustí dál — plánovač se tedy chová, jak se od něj
 * čeká, a nic se nespolkne.
 *
 * ## Proč se nepřeskakuje tiché selhání
 *
 * Úloha, která skončí bez výjimky, ale nic neudělá, se tady nepozná. To
 * hlídají kontroly (`kontroly.ts`), které se ptají na výsledek — podání
 * zásilky, vystavený doklad. Obal odpovídá jen na „proběhla?".
 */
export const sUlohou =
  (nazev: string, prace: (container: MedusaContainer) => Promise<unknown>) =>
  async (container: MedusaContainer): Promise<unknown> => {
    const start = Date.now()

    try {
      const vysledek = await prace(container)

      await zapisProvoz(container, {
        druh: "uloha",
        akce: `job:${nazev}`,
        stav: "ok",
        kdo: "systém",
        trvaloMs: Date.now() - start,
      })

      return vysledek
    } catch (error) {
      const zprava = String((error as Error)?.message ?? error)
      const stopa = String((error as Error)?.stack ?? "")
        .split("\n")
        .slice(1, 6)
        .map((radek) => radek.trim())

      await zapisProvoz(container, {
        druh: "uloha",
        akce: `job:${nazev}`,
        stav: "chyba",
        kdo: "systém",
        popis: zprava,
        detail: { chyba: zprava, stopa: stopa.join("\n") },
        trvaloMs: Date.now() - start,
      })

      /* Alarm nesmí přebít původní výjimku — kdyby selhalo i odeslání,
         plánovač má pořád dostat tu chybu, kvůli které úloha spadla. */
      try {
        await ohlasHned(container, {
          klic: `uloha-${nazev}`,
          nazev: `Úloha ${nazev}`,
          zprava: `spadla: ${zprava}`,
          detail: [`Úloha: ${nazev}`, `Výjimka: ${zprava}`, ...stopa],
        })
      } catch (chybaAlarmu) {
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(
            `[provoz] alarm k spadlé úloze ${nazev} se nepodařilo odeslat: ` +
              String((chybaAlarmu as Error)?.message ?? chybaAlarmu)
          )
      }

      throw error
    }
  }
