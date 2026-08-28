import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  applyBackorderDefault,
  BACKORDER_PRODUCT_FIELDS,
  loadBackorderExclusions,
} from "../lib/backorder-default"

/**
 * One-time default flip: „objednání bez skladu" for the existing catalog
 * (Matěj, 2026-08-16).
 *
 * New products no longer need this — `subscribers/default-backorder.ts` applies
 * the same rule on every product write. This script remains for the catalog as
 * it stands today and as a way to re-assert the default by hand after a bulk
 * import that ran with the worker off.
 *
 * The rule itself, including which products are deliberately skipped (výprodej,
 * zakázka, balíčky), lives in `lib/backorder-default.ts` so this script and the
 * subscriber cannot drift apart.
 *
 * Run with:  npx medusa exec ./src/scripts/enable-backorder-default.ts
 * Idempotent — variants already allowing backorder are left alone.
 */
export default async function enableBackorderDefault({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const exclusions = await loadBackorderExclusions(container)

  const pageSize = 200
  let skip = 0
  let updated = 0
  let skipped = 0

  // Paged: the previous version took the first 1000 products and silently
  // ignored anything past them, which is the kind of cap that reads as
  // "the whole catalog is done" right up until it isn't.
  for (;;) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: BACKORDER_PRODUCT_FIELDS,
      pagination: { take: pageSize, skip },
    })

    if (!products.length) {
      break
    }

    const result = await applyBackorderDefault(
      container,
      products as any[],
      exclusions
    )
    updated += result.updatedVariantIds.length
    skipped += result.skippedProducts

    if (products.length < pageSize) {
      break
    }
    skip += pageSize
  }

  if (!updated) {
    logger.info(
      `[backorder-default] Nic ke změně — všechny běžné varianty už objednání bez skladu povolují (${skipped} produktů vynecháno záměrně).`
    )
    return
  }

  logger.info(
    `[backorder-default] Hotovo: ${updated} variant nově povoluje objednání bez skladu; ${skipped} produktů vynecháno (výprodej / zakázka / balíček).`
  )
}
