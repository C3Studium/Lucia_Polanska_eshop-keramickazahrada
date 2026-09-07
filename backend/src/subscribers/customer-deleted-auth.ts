import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { najdiOsireleUcty } from "../lib/orphaned-auth"

/**
 * Hlásí, když se smazáním zákazníka osiří jeho přihlášení.
 *
 * Smazat zákazníka je legitimní úkon — omyl, úklid, žádost o výmaz údajů.
 * Přihlašovací identita se s ním ale nemaže a zůstane ukazovat na prázdno:
 * člověk se pak přihlásí správným heslem a obchod mu řekne, že účet není.
 * Podrobně v `lib/orphaned-auth.ts`.
 *
 * ## Proč to jen hlásí a nic nespravuje
 *
 * Správná oprava závisí na tom, PROČ se mazalo, a to subscriber neví.
 * U omylu se má zákazník obnovit; u žádosti o výmaz by obnovení bylo
 * porušení té žádosti a správně je uvolnit e-mail. Kdyby si tenhle kód
 * vybral sám, v jednom z těch dvou případů by nadělal škodu.
 *
 * Hlásí se proto nahlas do logu a Přehled to ukáže jako blok s tlačítky.
 * Tohle je poslední místo, kde se o tom ví přesně v okamžiku vzniku — bez
 * něj se na to přijde až tím, že si zákazník stěžuje.
 */
export default async function ohlasOsireleneUcty({
  event: { data },
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const smazani = new Set(
    (Array.isArray(data) ? data : [data]).map((z) => z?.id).filter(Boolean)
  )

  if (!smazani.size) {
    return
  }

  try {
    /* Táž funkce, jakou používá Přehled i skript — schválně, aby se ty tři
       cesty nemohly rozejít. Filtrovat identity přímo podle vnořeného pole
       v app_metadata by bylo kratší, ale nespolehlivé: kdyby dotaz přestal
       fungovat, subscriber by tiše nenašel nic a mlčel by dál. */
    const osirele = (await najdiOsireleUcty(container)).filter((u) =>
      smazani.has(u.customerId)
    )

    for (const u of osirele) {
      logger.warn(
        `[osiřelé účty] smazán zákazník ${u.customerId}, ale přihlášení ` +
          `${u.identityId} (${u.email}) na něj dál ukazuje. Člověk se přihlásí ` +
          `správným heslem a účet nenajde. Řeší se v Přehledu administrace.`
      )
    }
  } catch (chyba: any) {
    /* Hlášení nesmí shodit mazání zákazníka — to už proběhlo a tohle je jen
       zpráva o následku. */
    logger.error(
      `[osiřelé účty] kontrola po smazání selhala: ${chyba?.message ?? chyba}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.deleted",
}
