import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recordPriceHistory } from "../jobs/record-price-history"

/**
 * První záznam historie cen — dnešní ceny, hned po nasazení.
 *
 * Minulost se dopočítat nedá (dřív se nikde neukládala), takže „backfill"
 * znamená jen: nečekat na první hodinový běh jobu. Prvních 30 dní po nasazení
 * storefront u slev píše „nejnižší cena před slevou" místo „za 30 dní"
 * (`complete: false`, viz `lib/price-reference.ts`).
 *
 * Idempotentní — opakované spuštění téhož dne nic nezdvojí.
 *
 * Spustit:  npx medusa exec ./src/scripts/backfill-price-history.ts
 */
export default async function backfillPriceHistory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const result = await recordPriceHistory(container)
  logger.info(
    `[price-history] Backfill ${result.day}: pozorováno ${result.observed} cen, ${result.created} nových záznamů, ${result.updated} snížených.`
  )
}
