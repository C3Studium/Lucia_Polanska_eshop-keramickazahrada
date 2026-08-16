import type { ExecArgs } from "@medusajs/framework/types"
import { syncCurrencyPrices } from "../jobs/sync-currency-prices"

/**
 * Immediate run of the ČNB price sync — the daily job, on demand.
 *
 * Useful right after enabling a new currency in Nastavení → Store, so the
 * foreign prices exist now instead of after the next 14:30 fixing.
 *
 * Run with:  npx medusa exec ./src/scripts/sync-currency-prices.ts
 */
export default async function runSyncCurrencyPrices({ container }: ExecArgs) {
  await syncCurrencyPrices(container)
}
