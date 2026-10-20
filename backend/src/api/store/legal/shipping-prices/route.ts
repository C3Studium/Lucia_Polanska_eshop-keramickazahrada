import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getMerchantSettings } from "../../../../lib/merchant-settings"
import {
  buildShippingPrices,
  type RawRegion,
  type RawShippingOption,
} from "./prices"

/**
 * GET /store/legal/shipping-prices — veřejný ceník dopravy, jen ke čtení.
 *
 * Stránka „Doprava a platba" dřív nesla ceny opsané v textu (a dvě sady,
 * které si odporovaly). Ceny ale drží Medusa a mění je majitelka v adminu
 * (Doprava a platba), takže stránka je teď bere odtud — vždy tytéž, jaké
 * nabídne pokladna. `/store/shipping-options` k tomu nejde použít: potřebuje
 * košík, a stránka s ceníkem košík mít nemusí.
 *
 * Nic nezapisuje a nevrací nic, co by v pokladně nebylo vidět: názvy
 * možností, ceny, hranice „zdarma od" a doběrečné. Publikovatelný klíč
 * vynucuje Medusa pro celé `/store/*` sama.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const [{ data: options }, { data: regions }, settings] = await Promise.all([
      query.graph({
        entity: "shipping_option",
        fields: [
          "id",
          "name",
          "price_type",
          "provider_id",
          "rules.*",
          "prices.*",
          "prices.price_rules.*",
          "service_zone.geo_zones.country_code",
          "service_zone.fulfillment_set.type",
        ],
        pagination: { take: 200, skip: 0 },
      }),
      query.graph({
        entity: "region",
        fields: ["id", "name", "currency_code", "countries.iso_2"],
        pagination: { take: 50, skip: 0 },
      }),
      getMerchantSettings(req.scope).catch(() => null),
    ])

    // Ceník se mění zřídka; minuta v cache prohlížeče/CDN nikomu neublíží.
    res.setHeader("Cache-Control", "public, max-age=60")
    res.status(200).json({
      countries: buildShippingPrices(
        options as unknown as RawShippingOption[],
        regions as unknown as RawRegion[]
      ),
      // Doběrečné: jen ČR, jen Česká pošta na adresu (lib/dobirka-fee.ts).
      dobirka_fee_czk: settings?.dobirka_fee_czk ?? null,
      generated_at: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error(`[legal/shipping-prices] ${error?.message ?? error}`)
    res.status(503).json({ message: "Ceník dopravy se nepodařilo načíst." })
  }
}
