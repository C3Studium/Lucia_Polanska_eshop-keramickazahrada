import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import {
  convertFromCzk,
  fetchCnbRates,
  type CnbRateSheet,
} from "../lib/cnb-rates"

/**
 * Foreign-currency prices from the ČNB fixing (2026-08-16).
 *
 * The merchant prices everything in CZK; this job derives every other
 * currency the store has enabled (Nastavení → Store → měny) from the daily
 * ČNB kurzovní lístek, so enabling EUR is a one-click decision instead of a
 * second price list to maintain by hand.
 *
 * ## The rules
 *
 * - **CZK is never touched.** The job reads it, writes everything else.
 * - **Only base variant prices.** Seasonal price lists, deposits and bundle
 *   maths derive from the base price through their own machinery.
 * - **No enabled foreign currency → quiet no-op**, so the job costs nothing
 *   until the store actually goes multi-currency.
 * - A variant without a CZK price is skipped — there is nothing to derive
 *   from, and inventing a price is not this job's call.
 * - `CNB_PRICE_MARKUP_PERCENT` (optional) pads the conversion against
 *   exchange-rate drift between fixings. Read at call time like notify.ts,
 *   so unit tests never drag `lib/constants` (and its DATABASE_URL assert) in.
 *
 * Schedule: ČNB publishes around 14:30 Prague on working days; 13:35 UTC is
 * after publication the whole year (15:35 CEST / 14:35 CET). Weekend runs
 * re-apply Friday's fixing, which is exactly what ČNB says a weekend is.
 * Immediate run: `npx medusa exec ./src/scripts/sync-currency-prices.ts`.
 */

const CHUNK_SIZE = 25

export const syncCurrencyPrices = async (
  container: MedusaContainer
): Promise<void> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const [store] = (await container
    .resolve(Modules.STORE)
    .listStores({}, { relations: ["supported_currencies"] })) as any[]

  const supported = (store?.supported_currencies ?? []) as {
    currency_code: string
    is_default?: boolean
  }[]
  const defaultCurrency = supported.find((currency) => currency.is_default)
  const targets = supported
    .map((currency) => currency.currency_code.toLowerCase())
    .filter((code) => code !== "czk")

  if (defaultCurrency && defaultCurrency.currency_code.toLowerCase() !== "czk") {
    logger.warn(
      `[cnb] Výchozí měna obchodu není CZK (${defaultCurrency.currency_code}) — kurzy ČNB jsou vztažené ke koruně, přepočet se neprovede.`
    )
    return
  }
  if (!targets.length) {
    logger.info(
      "[cnb] Obchod má zapnutou jen korunu — žádné měny k přepočtu. Zapněte je v Nastavení → Store."
    )
    return
  }

  let sheet: CnbRateSheet
  try {
    sheet = await fetchCnbRates()
  } catch (error) {
    logger.error(
      `[cnb] ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }

  const missing = targets.filter((code) => !sheet.rates.has(code.toUpperCase()))
  if (missing.length) {
    logger.warn(
      `[cnb] Lístek ČNB nezná měny: ${missing.join(", ").toUpperCase()} — přeskočeny.`
    )
  }
  const convertible = targets.filter((code) =>
    sheet.rates.has(code.toUpperCase())
  )
  if (!convertible.length) {
    return
  }

  const markupPercent = Number(process.env.CNB_PRICE_MARKUP_PERCENT ?? 0) || 0

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "prices.id", "prices.amount", "prices.currency_code"],
    pagination: { take: 5000, skip: 0 },
  })

  type PriceRow = { currency_code: string; amount: number }
  const updates: { id: string; prices: PriceRow[] }[] = []

  for (const variant of variants as any[]) {
    const prices = (variant.prices ?? []) as any[]
    const czk = prices.find(
      (price) => String(price.currency_code).toLowerCase() === "czk"
    )
    const amountCzk = Number(czk?.amount)
    if (!czk || !Number.isFinite(amountCzk) || amountCzk <= 0) {
      continue
    }

    const next: PriceRow[] = [
      { currency_code: "czk", amount: amountCzk },
      ...convertible.map((code) => ({
        currency_code: code,
        amount: convertFromCzk(amountCzk, sheet.rates.get(code.toUpperCase())!, {
          markupPercent,
        }),
      })),
      // Currencies the store no longer converts (disabled, unknown to ČNB)
      // keep whatever price they had — deleting them is a merchant decision.
      ...prices
        .filter((price) => {
          const code = String(price.currency_code).toLowerCase()
          return code !== "czk" && !convertible.includes(code)
        })
        .map((price) => ({
          currency_code: String(price.currency_code).toLowerCase(),
          amount: Number(price.amount),
        })),
    ]

    const unchanged = next.every((row) =>
      prices.some(
        (price) =>
          String(price.currency_code).toLowerCase() === row.currency_code &&
          Number(price.amount) === row.amount
      )
    )
    if (unchanged && next.length === prices.length) {
      continue
    }

    updates.push({ id: variant.id, prices: next })
  }

  let written = 0
  for (let index = 0; index < updates.length; index += CHUNK_SIZE) {
    const chunk = updates.slice(index, index + CHUNK_SIZE)
    try {
      await updateProductVariantsWorkflow(container).run({
        input: { product_variants: chunk },
      })
      written += chunk.length
    } catch (error) {
      logger.error(
        `[cnb] Zápis cen selhal u dávky ${index / CHUNK_SIZE + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  logger.info(
    `[cnb] Kurzy z ${sheet.date}: přepočteno ${written} variant do měn ${convertible
      .join(", ")
      .toUpperCase()}${markupPercent ? ` (přirážka ${markupPercent} %)` : ""}; beze změny ${
      (variants as any[]).length - updates.length
    }.`
  )
}

export default async function syncCurrencyPricesJob(container: MedusaContainer) {
  await syncCurrencyPrices(container)
}

export const config = {
  name: "sync-currency-prices",
  // 13:35 UTC — after the ~14:30 Prague fixing in both winter and summer.
  schedule: "35 13 * * *",
}
