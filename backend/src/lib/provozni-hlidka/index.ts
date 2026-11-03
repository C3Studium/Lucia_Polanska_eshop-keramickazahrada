import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"
import { posliAlarm } from "./alarm"
import { KONTROLY } from "./kontroly"
import type { ZaznamProvozu } from "./denik"
import type { VysledekKontroly } from "./typy"

export * from "./typy"
export * from "./zapis"
export { KONTROLY } from "./kontroly"
export { posliAlarm, podpisChyby } from "./alarm"

/**
 * Provozní hlídka — spuštění a hlášení (3. 11. 2026).
 *
 * Alarmy chodí na vývojářskou adresu (`dev_notification_email` v Nastavení,
 * jinak `DEV_NOTIFICATION_EMAIL`): rozbitá fakturace ani vyčerpaný limit
 * e-mailů nejsou práce pro keramičku. Majitelka má svoje upozornění z §15
 * a tahle vrstva jí do nich nemluví.
 */

/**
 * Spustí všechny kontroly. Výjimka z jedné kontroly je taky nález — jinak
 * by jedna rozbitá kontrola zhasla i všechny ostatní, a to je přesně ten
 * druh selhání, který se nikdo nedozví.
 */
export const spustKontroly = async (
  container: MedusaContainer
): Promise<VysledekKontroly[]> => {
  const vysledky: VysledekKontroly[] = []

  for (const kontrola of KONTROLY) {
    try {
      const nalez = await kontrola.spust(container)
      vysledky.push({ klic: kontrola.klic, nazev: kontrola.nazev, ...nalez })
    } catch (error) {
      vysledky.push({
        klic: kontrola.klic,
        nazev: kontrola.nazev,
        stav: "chyba",
        zprava: "kontrola sama spadla",
        detail: [
          String((error as Error)?.message ?? error),
          String((error as Error)?.stack ?? "")
            .split("\n")
            .slice(1, 5)
            .map((radek) => radek.trim())
            .join("\n"),
        ].filter(Boolean),
      })
    }
  }

  return vysledky
}

/**
 * Pošle alarm ke každé rozbité kontrole.
 *
 * Podpis chyby se bere z PODROBNOSTÍ, ne jen z názvu kontroly: když ráno
 * selže faktura u #68 a odpoledne u #71, je to jiná chyba a musí přijít
 * druhý e-mail. Opakování téhož nálezu je pořád jeden e-mail za den —
 * dvacáté hlášení o jedné rozbité věci není informace.
 */
export const ohlasKontroly = async (
  container: MedusaContainer,
  vysledky: VysledekKontroly[],
  kdy: Date = new Date()
): Promise<number> => {
  let posláno = 0

  for (const vysledek of vysledky) {
    if (vysledek.stav !== "chyba") continue

    const stav = await posliAlarm(
      container,
      {
        klic: vysledek.klic,
        nazev: vysledek.nazev,
        zprava: vysledek.zprava,
        detail: vysledek.detail,
        podpis: [vysledek.zprava, ...(vysledek.detail ?? [])],
      },
      kdy
    )

    if (stav === "poslano") posláno += 1
  }

  return posláno
}

/**
 * Okamžitý alarm k jedné selhané věci — pro spadlou úlohu a pro chybu webu,
 * které vlastní kontrolu nemají.
 */
export const ohlasHned = async (
  container: MedusaContainer,
  vec: {
    klic: string
    nazev: string
    zprava: string
    detail?: string[]
    cehoSeTyka?: { typ: string; id: string } | null
  },
  kdy: Date = new Date()
): Promise<void> => {
  await posliAlarm(
    container,
    {
      ...vec,
      /* Jiný text výjimky = jiná chyba = další e-mail. Tentýž pád se po
         zbytek dne už jen zapisuje. */
      podpis: [vec.zprava],
    },
    kdy
  )
}

/** Záznamy deníku za okno — podklad pro denní souhrn a stránku Provoz. */
export const zaznamyZa = async (
  container: MedusaContainer,
  od: Date,
  doKdy: Date = new Date()
): Promise<ZaznamProvozu[]> => {
  try {
    const service = container.resolve(
      ACTIVITY_LOG_MODULE
    ) as ActivityLogModuleService

    const zaznamy = await service.listActivityEvents(
      { created_at: { $gte: od, $lte: doKdy } } as never,
      { take: 5000, order: { created_at: "DESC" } }
    )

    return zaznamy as unknown as ZaznamProvozu[]
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[provoz] deník se nepodařilo přečíst: ${String(
          (error as Error)?.message ?? error
        )}`
      )
    return []
  }
}
