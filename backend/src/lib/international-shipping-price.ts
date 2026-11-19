import { convertFromCzk } from "./cnb-rates"
import { isServiceLine } from "./packaging-lines"
import { CP_SERVICE_DEFAULT, cpQuote } from "./cp-kalkulacka"

/**
 * Čistá (bez Medusy) část dopravy „Česká pošta – na adresu zahraničí" —
 * sdílí ji modul dopravce (cena v pokladně) i administrace. Celek popisuje
 * `lib/international-shipping.ts` a docs/cp-kalkulacka/PLAN.md.
 *
 * Cena (19. 11. 2026, Matěj):
 * 1. hmotnost — mají-li hmotnost VŠECHNY výrobky v košíku, sečte se
 *    (gramy z Produkty+, razítko `ship_weight_g` na řádku košíku) + obal;
 *    jinak průměrná váha balíku z Nastavení obchodu. Vše v kg.
 * 2. cena — ceník ČP pro zemi, službu a tu hmotnost (kalkulačka ČP), nebo
 *    ruční cena, kterou majitelka zemi zadala.
 * 3. převod do měny regionu země kurzem ČNB (Medusa měnu košíku do výpočtu
 *    nepředává, země ale patří právě do jednoho regionu).
 */

export const INTERNATIONAL_SERVICE_CODE = "INT"
export const INTERNATIONAL_OPTION_ID = "cp-international"
export const INTERNATIONAL_OPTION_NAME = "Česká pošta – na adresu zahraničí"
export const INTERNATIONAL_ZONE_NAME = "Zahraničí"
/** Strop ruční ceny v Kč — překlep o řád nesmí projít. */
export const INTERNATIONAL_PRICE_MAX_CZK = 20_000
/** Nejvyšší váha, kterou ČP do zahraničí bere (podle země 20 nebo 30 kg). */
export const INTERNATIONAL_MAX_KG = 30
/** Velká Británie potřebuje celní prohlášení — ve výchozím stavu se nevozí. */
export const INTERNATIONAL_DEFAULT_OFF = ["gb"]

export type InternationalOptionData = {
  id: typeof INTERNATIONAL_OPTION_ID
  service_code: typeof INTERNATIONAL_SERVICE_CODE
  international: true
  /** Země, kam se posílá (ISO 2, malými). */
  countries: string[]
  /** Ruční cena v Kč podle země — přepíše ceník ČP. */
  overrides_czk: Record<string, number>
  /** Služba ČP (název z kalkulačky). */
  service: string
  /** Průměrná váha balíku (kg) — když některý výrobek nemá hmotnost. */
  parcel_weight_kg: number
  /** Krabice a výplň (kg) — přičte se k sečteným výrobkům. */
  packaging_kg: number
  /** Měna regionu podle země. */
  currency_by_country: Record<string, string>
  /** Kurz ČNB podle měny (Kč za `amount` jednotek). */
  rates: Record<string, { amount: number; rate: number }>
  /** Den kurzu ČNB („19.11.2026"). */
  rates_date: string | null
  markup_percent?: number
}

export const isInternationalOptionData = (data: unknown): boolean =>
  Boolean(data && typeof data === "object" && (data as any).international === true)

const COUNTRY = /^[a-z]{2}$/

/** Očistí ruční ceny: jen dvoupísmenné kódy, celé koruny v mezích, nikdy Česko. */
export const normalizePricesCzk = (input: unknown): Record<string, number> => {
  const out: Record<string, number> = {}
  if (!input || typeof input !== "object" || Array.isArray(input)) return out
  for (const [rawCode, rawValue] of Object.entries(input as Record<string, unknown>)) {
    const code = rawCode.trim().toLowerCase()
    if (!COUNTRY.test(code) || code === "cz") continue
    if (rawValue === null || rawValue === undefined || rawValue === "") continue
    const value = Math.round(Number(String(rawValue).replace(",", ".")))
    if (!Number.isFinite(value) || value <= 0 || value > INTERNATIONAL_PRICE_MAX_CZK) continue
    out[code] = value
  }
  return out
}

const quantityOf = (item: any): number => {
  const raw = item?.quantity
  const value =
    typeof raw === "object" && raw !== null ? Number(raw.numeric ?? raw.value ?? raw.raw?.value ?? 0) : Number(raw ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

const round3 = (value: number) => Math.round(value * 1000) / 1000

export type ParcelWeight = {
  kg: number
  /** `vyrobky` = sečteno z výrobků (+ obal), `prumer` = průměr z nastavení. */
  source: "vyrobky" | "prumer"
  /** Kolik výrobků v košíku hmotnost nemá (proč se vzal průměr). */
  missing: number
}

/**
 * Hmotnost zásilky v kg. Mají-li hmotnost všechny výrobky (`ship_weight_g`
 * na řádku, gramy), sečtou se + obal; jinak průměr z nastavení. Balné,
 * doběrečné a jiné servisní řádky se nepočítají.
 */
export const parcelWeightOf = (
  items: any[],
  settings: { parcel_weight_kg: number; packaging_kg?: number }
): ParcelWeight => {
  const goods = (items ?? []).filter(
    (item) => item && !isServiceLine(item) && (item.product_id || item.variant_id) && quantityOf(item) > 0
  )
  const fallback = Number(settings.parcel_weight_kg) > 0 ? Number(settings.parcel_weight_kg) : 3
  const grams = goods.map((item) => Number(item?.metadata?.ship_weight_g ?? 0))
  const missing = grams.filter((g) => !(g > 0)).length
  if (!goods.length || missing > 0) {
    return { kg: round3(fallback), source: "prumer", missing }
  }
  const summed = goods.reduce((sum, item, index) => sum + (grams[index] * quantityOf(item)) / 1000, 0)
  const packaging = Number(settings.packaging_kg) > 0 ? Number(settings.packaging_kg) : 0
  return { kg: round3(summed + packaging), source: "vyrobky", missing: 0 }
}

export type InternationalQuote = {
  country: string
  kg: number
  price_czk: number
  /** Služba ČP, ze které je cena (null = ruční cena majitelky). */
  service: string | null
  up_to_kg: number | null
  fallback: boolean
  manual: boolean
  currency_code: string
  amount: number
}

/**
 * Cena pro zemi a hmotnost, nebo `null`: země se nevozí, ČP tam takový
 * balík nevozí (moc těžký), nebo chybí kurz měny. Bez ceny se volba
 * v pokladně nenabídne — lepší než naúčtovat špatnou částku.
 */
export const internationalQuoteFor = (
  data: unknown,
  countryCode: unknown,
  kg: number
): InternationalQuote | null => {
  if (!isInternationalOptionData(data)) return null
  const option = data as InternationalOptionData
  const country = String(countryCode ?? "").trim().toLowerCase()
  if (!country || !(option.countries ?? []).includes(country)) return null

  const manual = option.overrides_czk?.[country]
  const quote = manual ? null : cpQuote(country, option.service || CP_SERVICE_DEFAULT, kg)
  const priceCzk = manual ?? quote?.price_czk
  if (!priceCzk || !(priceCzk > 0)) return null

  const currency = String(option.currency_by_country?.[country] ?? "").toLowerCase()
  if (!currency) return null
  let amount = priceCzk
  if (currency !== "czk") {
    const rate = option.rates?.[currency.toUpperCase()]
    if (!rate || !(rate.rate > 0)) return null
    amount = convertFromCzk(
      priceCzk,
      { code: currency.toUpperCase(), amount: rate.amount || 1, rate: rate.rate },
      { markupPercent: option.markup_percent ?? 0 }
    )
  }
  return {
    country,
    kg,
    price_czk: priceCzk,
    service: quote?.service ?? null,
    up_to_kg: quote?.up_to_kg ?? null,
    fallback: quote?.fallback ?? false,
    manual: Boolean(manual),
    currency_code: currency,
    amount,
  }
}

/** Cena v pokladně: hmotnost košíku → cena pro zemi doručení. */
export const internationalPriceFor = (
  optionData: unknown,
  countryCode: unknown,
  items: any[] = []
): { currency_code: string; amount: number; kg: number } | null => {
  if (!isInternationalOptionData(optionData)) return null
  const option = optionData as InternationalOptionData
  const weight = parcelWeightOf(items, option)
  const quote = internationalQuoteFor(option, countryCode, weight.kg)
  return quote ? { currency_code: quote.currency_code, amount: quote.amount, kg: weight.kg } : null
}
