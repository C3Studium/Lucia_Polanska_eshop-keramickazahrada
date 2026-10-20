import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import {
  observationsFromCalculatedPrice,
  planDailyUpsert,
  pragueDay,
  type PriceObservation,
} from "../lib/price-reference"
import { PRICE_HISTORY_MODULE } from "../modules/price-history"
import type PriceHistoryModuleService from "../modules/price-history/service"

/**
 * Zápis historie cen pro § 12a ZOS (nejnižší cena za 30 dní před slevou).
 *
 * ## Co zapisuje
 *
 * Pro každou variantu zveřejněného výrobku a každou měnu, ve které obchod
 * prodává (jedna oblast na měnu — stejný cenový kontext, jaký dostává
 * storefront: `region_id` + `currency_code`):
 * - běžnou cenu (`original_amount`) jako `base`,
 * - akční cenu z price-listu typu „sale" jako `sale`, jen když je nižší.
 *
 * Kusy s vadou se zapisují svou skutečnou cenou jako `base`; jejich
 * `clearance_original_price` se nezapisuje — není to předchozí cena tohohle
 * kusu a § 12a se na kusy s vadou nevztahuje (viz `models/price-history-entry`).
 *
 * ## Proč každou hodinu, když stačí den
 *
 * Řádek dne drží NEJNIŽŠÍ cenu, kterou job ten den viděl, a běh jen
 * doplňuje chybějící řádky nebo je posouvá dolů — opakovaný běh je tedy
 * zadarmo a idempotentní. Hodinový krok zachytí i slevu nebo zlevnění, které
 * trvalo jen část dne (denní snímek ve 2:30 by ho minul), a slevu založenou
 * dopoledne vidí už v poledne. Jeden běh = jeden dotaz na ceny za měnu
 * a jeden výpis dnešních řádků; zápisy jen při změně.
 *
 * Okamžitý běh (po nasazení): `npx medusa exec ./src/scripts/backfill-price-history.ts`.
 */

const PAGE_SIZE = 200
const WRITE_CHUNK = 200

export type RecordPriceHistoryResult = {
  day: string
  observed: number
  created: number
  updated: number
}

export const recordPriceHistory = async (
  container: MedusaContainer,
  now: Date = new Date()
): Promise<RecordPriceHistoryResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const regionModule = container.resolve(Modules.REGION)
  const history = container.resolve<PriceHistoryModuleService>(
    PRICE_HISTORY_MODULE
  )

  const day = pragueDay(now)

  // Jedna oblast na měnu: cena se počítá stejně jako ve storefrontu, který
  // posílá `region_id` své oblasti (ceny s pravidlem na oblast by bez něj
  // nevyšly).
  const regions = (await regionModule.listRegions(
    {},
    { select: ["id", "currency_code"] }
  )) as Array<{ id: string; currency_code?: string | null }>
  const regionByCurrency = new Map<string, string>()
  for (const region of regions) {
    const code = String(region.currency_code ?? "").toLowerCase()
    if (code && !regionByCurrency.has(code)) {
      regionByCurrency.set(code, region.id)
    }
  }

  const observations: PriceObservation[] = []

  for (const [currency, regionId] of regionByCurrency) {
    let skip = 0
    for (;;) {
      const { data: products, metadata } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.calculated_price.*"],
        filters: { status: "published" },
        pagination: { skip, take: PAGE_SIZE },
        context: {
          variants: {
            calculated_price: QueryContext({
              region_id: regionId,
              currency_code: currency,
            }),
          },
        },
      })

      for (const product of products as any[]) {
        for (const variant of (product?.variants ?? []) as any[]) {
          if (!variant?.id) continue
          observations.push(
            ...observationsFromCalculatedPrice(
              variant.id,
              currency,
              variant.calculated_price
            )
          )
        }
      }

      skip += PAGE_SIZE
      const total = Number((metadata as { count?: number } | undefined)?.count ?? 0)
      if (!products.length || skip >= total) break
    }
  }

  const existing = (await history.listPriceHistoryEntries({
    recorded_on: day,
  })) as any[]

  const plan = planDailyUpsert(existing, observations, day)

  for (let i = 0; i < plan.create.length; i += WRITE_CHUNK) {
    await history.createPriceHistoryEntries(plan.create.slice(i, i + WRITE_CHUNK))
  }
  for (let i = 0; i < plan.update.length; i += WRITE_CHUNK) {
    await history.updatePriceHistoryEntries(plan.update.slice(i, i + WRITE_CHUNK))
  }

  if (plan.create.length || plan.update.length) {
    logger.info(
      `[price-history] ${day}: ${plan.create.length} nových záznamů, ${plan.update.length} snížených (pozorováno ${observations.length} cen).`
    )
  }

  return {
    day,
    observed: observations.length,
    created: plan.create.length,
    updated: plan.update.length,
  }
}

export default async function recordPriceHistoryJob(
  container: MedusaContainer
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await recordPriceHistory(container)
  } catch (error) {
    // Souběžný běh narazí na unikátní index dne — další hodina to dorovná.
    logger.warn(
      `[price-history] Zápis historie cen se nepodařil: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config = {
  name: "record-price-history",
  // Každou hodinu v :17 — mimo plné hodiny, kdy běží ostatní joby.
  schedule: "17 * * * *",
}
