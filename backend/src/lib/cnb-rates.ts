import { defaultCurrencies } from "@medusajs/framework/utils"

/**
 * ČNB kurzovní lístek — the official CZK exchange rates (2026-08-16).
 *
 * ## Why ČNB and not an exchange-rate API
 *
 * The shop prices everything in CZK; foreign-currency prices are derived.
 * The Czech National Bank publishes the authoritative daily fixing — free,
 * no API key, no terms to outgrow, and it is the same rate Czech accounting
 * uses, so an invoice and a storefront price can never disagree about where
 * a number came from. Published every working day around 14:30; on weekends
 * and holidays the last fixing simply stays valid.
 *
 * Wire format (pipe-separated, Czech decimal comma):
 *
 *     14.08.2026 #156
 *     země|měna|množství|kód|kurz
 *     EMU|euro|1|EUR|24,210
 *     Maďarsko|forint|100|HUF|6,127
 *
 * `kurz` is CZK per `množství` units of the currency — HUF is quoted per
 * 100, JPY per 100, so the amount must always ride along with the rate.
 */

export const CNB_RATES_URL =
  "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt"

export type CnbRate = {
  code: string
  /** How many units of the currency the rate is quoted for (1, 100, …). */
  amount: number
  /** CZK per `amount` units. */
  rate: number
}

export type CnbRateSheet = {
  /** The fixing date as printed by ČNB, e.g. "14.08.2026". */
  date: string
  rates: Map<string, CnbRate>
}

export class CnbRatesError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = "CnbRatesError"
  }
}

/** Parses the raw ČNB text file. Pure, so the format is pinned by unit tests. */
export const parseCnbRates = (raw: string): CnbRateSheet => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 3) {
    throw new CnbRatesError("ČNB: kurzovní lístek má nečekaný formát.")
  }

  const date = lines[0].split("#")[0]?.trim() ?? ""
  const rates = new Map<string, CnbRate>()

  // Line 0 is the date, line 1 the header — data starts at line 2.
  for (const line of lines.slice(2)) {
    const columns = line.split("|")
    if (columns.length !== 5) {
      continue
    }
    const amount = Number(columns[2])
    const code = columns[3]?.trim().toUpperCase()
    const rate = Number(columns[4].replace(",", "."))
    if (!code || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) {
      continue
    }
    rates.set(code, { code, amount, rate })
  }

  if (!rates.size) {
    throw new CnbRatesError("ČNB: kurzovní lístek neobsahuje žádné kurzy.")
  }

  return { date, rates }
}

export const fetchCnbRates = async (
  timeoutMs = 15_000
): Promise<CnbRateSheet> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(CNB_RATES_URL, {
      headers: { Accept: "text/plain" },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new CnbRatesError(
        `ČNB: kurzovní lístek se nepodařilo stáhnout (HTTP ${response.status}).`
      )
    }
    return parseCnbRates(await response.text())
  } catch (error) {
    if (error instanceof CnbRatesError) {
      throw error
    }
    throw new CnbRatesError("ČNB: kurzovní lístek se nepodařilo stáhnout.", {
      cause: error,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/** Decimal places a currency is charged in — JPY/HUF have none, EUR two. */
export const decimalDigitsFor = (currencyCode: string): number => {
  const record = (
    defaultCurrencies as Record<string, { decimal_digits?: number }>
  )[currencyCode.toUpperCase()]
  return record?.decimal_digits ?? 2
}

/**
 * A CZK price in a foreign currency, via the ČNB fixing.
 *
 * The optional markup covers exchange-rate drift between daily fixings —
 * a shop that rounds a week of EUR volatility in the customer's favour is
 * losing margin silently, so the merchant can pad the conversion by a few
 * percent. Rounding is half-up to the currency's own decimal places.
 */
export const convertFromCzk = (
  amountCzk: number,
  rate: CnbRate,
  options: { markupPercent?: number; decimalDigits?: number } = {}
): number => {
  const markup = 1 + (options.markupPercent ?? 0) / 100
  const digits = options.decimalDigits ?? decimalDigitsFor(rate.code)
  const raw = (amountCzk / (rate.rate / rate.amount)) * markup
  const factor = 10 ** digits
  return Math.round(raw * factor) / factor
}
