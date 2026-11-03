import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notifyMerchant, resolveRecipient } from "../lib/notify"
import { getNotificationAddresses } from "../lib/notify"
import { spustKontroly, zaznamyZa } from "../lib/provozni-hlidka"
import { textDeniku } from "../lib/provozni-hlidka/denik"
import { klicSouhrnu, predmetSouhrnu, textSouhrnu } from "../lib/provozni-hlidka/zprava"
import { sUlohou } from "../lib/provozni-hlidka/uloha"
import { ACTIVITY_LOG_MODULE } from "../modules/activity-log"
import type ActivityLogModuleService from "../modules/activity-log/service"

/**
 * Provozní souhrn na konec dne (3. 11. 2026, 21:00 Praha).
 *
 * ## Co v něm je a proč
 *
 * Dvě části. Nejdřív **co se stalo** — po druzích: kolik plateb, e-mailů,
 * reklamací, přihlášení, změn v administraci. Pak **co je zkontrolované** —
 * verdikty hlídky. Obojí schválně: seznam chyb neodpoví na otázku „proběhlo
 * všechno, co mělo?", protože den, kdy se nezachytila ani jedna platba,
 * žádnou chybu nevyrobí a přesto je špatně.
 *
 * ## Proč jde jen vývojáři
 *
 * Je to technická zpráva — počty požadavků, stavové kódy, texty výjimek.
 * Majitelka má svůj obchodní souhrn v 7:05 (`send-daily-summary`) a tahle
 * zpráva jí do něj nemluví.
 *
 * ## Úklid
 *
 * Deník si drží třicet dní. Je to pozorovací záznam, ne doklad: na dohledání
 * chyby je měsíc víc než dost a nekonečná tabulka řádků z každého požadavku
 * by za rok byla největší věc v databázi.
 */

const DEN = 24 * 60 * 60 * 1000
const DNU_ZPET = 30

async function sendProvozniSouhrn(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const prijemce = resolveRecipient(
    "dev",
    await getNotificationAddresses(container)
  )

  if (!prijemce) {
    logger.info(
      "[provoz] souhrn se neodesílá: není nastavená vývojářská adresa " +
        "(Nastavení → E-maily, ani env DEV_NOTIFICATION_EMAIL)."
    )
    return
  }

  const kdy = new Date()
  const vysledky = await spustKontroly(container)
  const zaznamy = await zaznamyZa(container, new Date(kdy.getTime() - DEN), kdy)

  const telo = [
    "CO SE DNES STALO",
    "",
    textDeniku(zaznamy),
    "",
    "CO JE ZKONTROLOVANÉ",
    "",
    textSouhrnu(vysledky, kdy),
  ].join("\n")

  await notifyMerchant(container, {
    key: klicSouhrnu(kdy),
    title: predmetSouhrnu(vysledky, kdy),
    description: telo,
    audience: "dev",
    /* E-mail ano, ale ne „urgent": souhrn není poplach, a červený rámeček
       u denní zprávy by poplach odnaučil brát vážně. */
    email: true,
  })

  await uklidDeniku(container)
}

/** Smaže záznamy starší než třicet dní. Selhání úklidu souhrn nezhodí. */
const uklidDeniku = async (container: MedusaContainer): Promise<void> => {
  try {
    const service = container.resolve(
      ACTIVITY_LOG_MODULE
    ) as ActivityLogModuleService

    const hranice = new Date(Date.now() - DNU_ZPET * DEN)
    const stare = await service.listActivityEvents(
      { created_at: { $lt: hranice } } as never,
      { take: 5000, select: ["id"] }
    )

    if (!stare.length) return

    await service.deleteActivityEvents(stare.map((zaznam) => zaznam.id))

    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(`[provoz] úklid deníku: smazáno ${stare.length} starých záznamů`)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[provoz] úklid deníku se nepovedl: ${String(
          (error as Error)?.message ?? error
        )}`
      )
  }
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc hned e-mailem. */
export default sUlohou("send-provozni-souhrn", sendProvozniSouhrn)

export const config = {
  name: "send-provozni-souhrn",
  /* 20:00 UTC = 21:00 v Praze v zimě. Konec dne, ne půlnoc: zpráva má
     dojít, dokud ji má smysl číst. */
  schedule: "0 20 * * *",
}
