import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getNotificationAddresses,
  notifyMerchant,
  resolveRecipient,
} from "../notify"
import {
  nevyrizene,
  oznacOdeslano,
  pocetVeci,
  predmetFronty,
  seskup,
  textFronty,
  type SkupinaFronty,
} from "./fronta"

/**
 * Souhrn chyb po 4 hodinách (4. 11. 2026) — jediný vývojářský e-mail mimo
 * večerní provozní souhrn. Bez chyb nic neodejde.
 *
 * Odděleno od `fronta.ts`, protože tady se posílá (`notifyMerchant`) a
 * `notifyMerchant` sám frontu plní — v jednom souboru by se importy kruhem
 * zacyklily.
 */

export type ObsahFronty = {
  od: Date
  doKdy: Date
  skupiny: SkupinaFronty[]
  hlaseni: number
}

/** Přečte a sloučí, co čeká. Prázdné skupiny = nic se nepokazilo. */
export const prectiFrontu = async (
  container: MedusaContainer,
  doKdy: Date
): Promise<ObsahFronty> => {
  const { od, polozky } = await nevyrizene(container, doKdy)
  return { od, doKdy, skupiny: seskup(polozky), hlaseni: polozky.length }
}

/** Zapíše konec okna — další souhrn začíná tady. */
export const uzavriFrontu = async (
  container: MedusaContainer,
  obsah: ObsahFronty
): Promise<void> => {
  await oznacOdeslano(container, {
    od: obsah.od,
    doKdy: obsah.doKdy,
    pocet: obsah.skupiny.length,
    hlaseni: obsah.hlaseni,
  })
}

/**
 * Pošle souhrn chyb za okno od minulého souhrnu. Vrací počet různých věcí
 * v něm (0 = nic neodešlo).
 *
 * Bez vývojářské adresy se okno NEUZAVÍRÁ: chyby počkají ve frontě, než se
 * adresa doplní (nejvýš týden zpátky).
 */
export const posliSouhrnChyb = async (
  container: MedusaContainer,
  kdy: Date = new Date()
): Promise<number> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const obsah = await prectiFrontu(container, kdy)

  if (!obsah.skupiny.length) {
    await uzavriFrontu(container, obsah)
    logger.info("[provoz] souhrn chyb: za poslední okno nic, e-mail se neposílá")
    return 0
  }

  const prijemce = resolveRecipient(
    "dev",
    await getNotificationAddresses(container)
  )
  if (!prijemce) {
    logger.warn(
      `[provoz] souhrn chyb (${obsah.skupiny.length}) se neodesílá: chybí ` +
        "vývojářská adresa (Nastavení → E-maily, ani env DEV_NOTIFICATION_EMAIL)."
    )
    return 0
  }

  await notifyMerchant(container, {
    /* Klíč nese konec okna: opakovaný běh téže úlohy nepošle souhrn dvakrát. */
    key: `mn:hlidkachyby:${kdy.toISOString().slice(0, 13)}`,
    title: predmetFronty(obsah.skupiny, obsah.od, kdy),
    description: textFronty(obsah.skupiny, obsah.od, kdy),
    audience: "dev",
    urgent: true,
    souhrn: true,
  })

  await uzavriFrontu(container, obsah)

  logger.warn(
    `[provoz] souhrn chyb odeslán: ${pocetVeci(obsah.skupiny.length)}, ${obsah.hlaseni} hlášení`
  )
  return obsah.skupiny.length
}
