import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { posliAlarm } from "./alarm"
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
 * ## Proč se nepozná tiché selhání
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
        /* Alarm posílá tenhle obal sám, s názvem úlohy a stopou — bez
           tohohle by k jednomu pádu odešly dva e-maily. */
        bezAlarmu: true,
      })

      /* Alarm nesmí přebít původní výjimku: `posliAlarm` nikdy nevyhazuje,
         takže plánovač dostane tu chybu, kvůli které úloha spadla. */
      const stavAlarmu = await posliAlarm(container, {
        klic: `uloha-${nazev}`,
        nazev: `Úloha ${nazev}`,
        zprava: `spadla: ${zprava}`,
        detail: [`Úloha: ${nazev}`, `Výjimka: ${zprava}`, ...stopa],
        /* Jiná výjimka = jiná chyba = další řádek souhrnu. Tentýž pád se
           v souhrnu sloučí s počtem opakování. */
        podpis: [zprava],
      })

      if (stavAlarmu === "chyba") {
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(`[provoz] alarm k spadlé úloze ${nazev} se nepodařilo odeslat`)
      }

      throw error
    }
  }
