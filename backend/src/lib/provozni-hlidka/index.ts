import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notifyMerchant } from "../notify"
import { ACTIVITY_LOG_MODULE } from "../../modules/activity-log"
import type ActivityLogModuleService from "../../modules/activity-log/service"
import { KONTROLY } from "./kontroly"
import type { ZaznamProvozu } from "./denik"
import type { VysledekKontroly } from "./typy"
import { klicAlarmu, predmetAlarmu, textAlarmu } from "./zprava"

export * from "./typy"
export * from "./zapis"
export { KONTROLY } from "./kontroly"

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
            .join("\n"),
        ].filter(Boolean),
      })
    }
  }

  return vysledky
}

/**
 * Pošle alarm ke každé rozbité kontrole. Klíč nese den, takže jedna rozbitá
 * věc píše jednou denně — hlídka běží každou čtvrthodinu a Resend dává sto
 * e-mailů denně, takže neomezený alarm by vyčerpal limit a obchod by pak
 * nemohl napsat zákazníkovi.
 */
export const ohlasKontroly = async (
  container: MedusaContainer,
  vysledky: VysledekKontroly[],
  kdy: Date = new Date()
): Promise<number> => {
  let posláno = 0

  for (const vysledek of vysledky) {
    if (vysledek.stav !== "chyba") continue

    await notifyMerchant(container, {
      key: klicAlarmu(vysledek.klic, kdy),
      title: predmetAlarmu(vysledek),
      description: textAlarmu(vysledek, kdy),
      audience: "dev",
      urgent: true,
    })
    posláno += 1
  }

  return posláno
}

/**
 * Okamžitý alarm k jedné selhané věci — pro spadlou úlohu a pro chybu webu,
 * které nemají vlastní kontrolu a o kterých by se jinak nikdo nedozvěděl.
 *
 * Klíč drží jedno hlášení za hodinu na tutéž věc: častěji je to při opakované
 * chybě jen spam, a vzácnější by schovalo, že se to děje pořád.
 */
export const ohlasHned = async (
  container: MedusaContainer,
  vec: {
    klic: string
    nazev: string
    zprava: string
    detail?: string[]
  },
  kdy: Date = new Date()
): Promise<void> => {
  const hodina = kdy.toISOString().slice(0, 13)
  const vysledek: VysledekKontroly = {
    klic: vec.klic,
    nazev: vec.nazev,
    stav: "chyba",
    zprava: vec.zprava,
    detail: vec.detail,
  }

  await notifyMerchant(container, {
    key: `mn:hlidka-${vec.klic}:${hodina}`,
    title: predmetAlarmu(vysledek),
    description: textAlarmu(vysledek, kdy),
    audience: "dev",
    urgent: true,
  })
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
