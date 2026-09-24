import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Srdeční tep CMS — drží Supabase projekt storefront CMS vzhůru.
 *
 * ## Proč to dělá backend
 *
 * Supabase na free plánu uspí projekt po ~7 dnech bez provozu přes jeho API
 * bránu; uspaný projekt = web bez CMS obsahu a obrázků, bez jediné chyby,
 * která by řekla proč. Něco to tedy musí pravidelně volat zvenčí — a backend
 * je jediný proces téhle sestavy, který na Railway prokazatelně běží 24/7 a
 * plánovač už má. Žádný nový worker, žádná další služba.
 *
 * ## Co se volá
 *
 * `<storefront>/api/cms/heartbeat` (ValeCMS, server/heartbeat.js): každé
 * zavolání sáhne přes Supabase API na několik počtů, a jednou za 5 dní pošle
 * správcům přehledový e-mail (razítko si CMS drží samo v cms_setting, takže
 * denní volání NEznamená denní e-mail). Denně proto, že pětidenní kadence
 * proti sedmidennímu prahu uspání nemá rezervu na jediný nepovedený běh.
 *
 * ## Když chybí konfigurace
 *
 * Bez CMS_CRON_SECRET nebo bez adresy storefrontu se jen zaloguje a skončí —
 * je to doplněk provozu CMS, ne jeho podmínka, a job, který kvůli chybějící
 * proměnné denně vyhazuje, jen učí lidi ignorovat log.
 */

const base = (): string =>
  (process.env.STOREFRONT_PUBLIC_URL || process.env.MEDUSA_STOREFRONT_URL || "").replace(/\/+$/, "")

export default async function cmsHeartbeat(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const secret = (process.env.CMS_CRON_SECRET || "").trim()
  const storefront = base()

  if (!secret || !storefront) {
    logger.info(
      "[cms-heartbeat] přeskočeno — chybí CMS_CRON_SECRET nebo STOREFRONT_PUBLIC_URL/MEDUSA_STOREFRONT_URL"
    )
    return
  }

  // Bez country segmentu: /api/* jde mimo regionální middleware storefrontu.
  const url = `${storefront}/api/cms/heartbeat`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30_000),
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      // Error, ne warn: jediný smysl jobu je nedopustit uspání projektu,
      // takže tep, který neprošel, je selhání, ne zajímavost.
      logger.error(
        `[cms-heartbeat] ${url} odpověděla ${response.status}: ${JSON.stringify(body?.error ?? body)}`
      )
      return
    }

    const mailed = body?.mail?.sent
    logger.info(
      `[cms-heartbeat] databáze dotčena${mailed ? `, přehled odeslán (${mailed} příjemců)` : ""}`
    )
  } catch (error) {
    logger.error(`[cms-heartbeat] volání ${url} selhalo: ${String((error as Error)?.message ?? error)}`)
  }
}

export const config = {
  name: "cms-heartbeat",
  // Denně v 5:33 UTC (ráno CZ) — mimo celé hodiny, kdy se tlačí ostatní joby.
  schedule: "33 5 * * *",
}
