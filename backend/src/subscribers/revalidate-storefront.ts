import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Po každé změně katalogu zaklepat obchodu, ať zahodí uloženou podobu stránek.
 *
 * ## Proč
 *
 * Data obchodu se cachují na serveru Next.js. Bez tohohle by se nový výrobek,
 * balíček nebo sleva objevily zákazníkům až po vypršení cache — a to je nejen
 * dlouhé, ale hlavně nepředvídatelné. Naměřeno při zapínání prodeje bez skladu:
 * API u všech variant vracelo `allow_backorder: true`, ale mřížka ještě dlouho
 * hlásila „Prodáno".
 *
 * ## Co to NEdělá
 *
 * Nezasahuje do administrace — ta se obnovuje sama (`invalidateQueries`
 * v komponentách po každé změně). Tohle je čistě směrem k obchodu.
 *
 * ## Proč to nikdy nesmí shodit zápis
 *
 * Přeposlání je vedlejší efekt. Když obchod neběží, změní se adresa nebo se
 * zapomene tajemství, nesmí to shodit vytvoření výrobku — chyba se zaloguje
 * a jede se dál. Cache si nakonec vyprší sama; nedokončený zápis by se sám
 * nespravil.
 */

const CESTY_KATALOGU = ["/[countryCode]/store", "/[countryCode]"]

export default async function revalidateStorefront({
  container,
  event,
}: SubscriberArgs<unknown>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const zaklad = (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    ""
  ).replace(/\/+$/, "")
  const tajemstvi = process.env.REVALIDATE_SECRET

  if (!zaklad || !tajemstvi) {
    /* Ve vývoji běžný stav: obchod nikam neposlouchá nebo tajemství není.
       Varovat jednou za událost stačí — chybu z toho dělat nelze. */
    logger.debug(
      "[revalidate] Přeskočeno — chybí STOREFRONT_PUBLIC_URL nebo REVALIDATE_SECRET."
    )
    return
  }

  try {
    const odpoved = await fetch(`${zaklad}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": tajemstvi,
      },
      body: JSON.stringify({ paths: CESTY_KATALOGU }),
      /* Krátký strop: tohle je úklid po zápisu, ne součást zápisu. */
      signal: AbortSignal.timeout(5000),
    })

    if (!odpoved.ok) {
      logger.warn(
        `[revalidate] Obchod odmítl obnovu po události ${event.name}: HTTP ${odpoved.status}.`
      )
      return
    }

    logger.info(`[revalidate] Obchod si po události ${event.name} obnoví katalog.`)
  } catch (chyba) {
    logger.warn(
      `[revalidate] Obnovu obchodu po události ${event.name} se nepodařilo vyžádat: ` +
        (chyba instanceof Error ? chyba.message : String(chyba))
    )
  }
}

export const config: SubscriberConfig = {
  /*
   * Co mění to, co je v obchodě vidět. Cena a sklad jsou tu schválně taky:
   * zákazníkovi je jedno, jestli se změnil výrobek nebo jen jeho cena — vidí
   * jednu a tutéž stránku.
   */
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-variant.created",
    "product-variant.updated",
    "product-variant.deleted",
    "product-collection.created",
    "product-collection.updated",
    "product-collection.deleted",
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
    "promotion.created",
    "promotion.updated",
    "promotion.deleted",
    "price-list.created",
    "price-list.updated",
    "price-list.deleted",
  ],
  context: { subscriberId: "revalidate-storefront" },
}
