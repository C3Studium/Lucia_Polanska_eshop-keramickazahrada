/**
 * Veřejný ceník dopravy — čistá logika (bez databáze), aby šla otestovat.
 *
 * Vstup jsou syrové řádky z `query.graph` (možnosti dopravy s cenami a
 * zónami, regiony se zeměmi), výstup je ceník po zemích: pro každou zemi,
 * kam některá možnost doručuje, seznam možností s cenou v měně regionu té
 * země. Stejná pravidla, jaká používá pokladna Medusy:
 *
 * - cena s pravidlem `region_id` má přednost před obecnou cenou v měně,
 * - cena s pravidlem `item_total` (typicky 0 Kč od určité hodnoty košíku)
 *   je podmíněná sazba — „doprava zdarma od …", ne základní cena,
 * - vratné možnosti (`is_return`) a možnosti skryté z obchodu
 *   (`enabled_in_store = false`) se do ceníku nedávají.
 */

export type RawPriceRule = {
  attribute?: string | null
  operator?: string | null
  value?: unknown
}

export type RawPrice = {
  amount?: unknown
  currency_code?: string | null
  price_rules?: RawPriceRule[] | null
}

export type RawShippingOption = {
  id: string
  name?: string | null
  price_type?: string | null
  provider_id?: string | null
  rules?: RawPriceRule[] | null
  prices?: RawPrice[] | null
  service_zone?: {
    geo_zones?: { country_code?: string | null }[] | null
    fulfillment_set?: { type?: string | null } | null
  } | null
}

export type RawRegion = {
  id: string
  name?: string | null
  currency_code?: string | null
  countries?: { iso_2?: string | null }[] | null
}

export type PriceTier = {
  amount: number
  /** Podmínka na hodnotu zboží v košíku (`item_total`). */
  operator: "gt" | "gte" | "lt" | "lte" | "eq"
  value: number
}

export type PublicShippingOption = {
  id: string
  name: string
  /** `pickup` = osobní odběr, `shipping` = dopravce. */
  type: "pickup" | "shipping"
  /** `calculated` = cenu spočítá až pokladna (podle košíku). */
  price_type: "flat" | "calculated"
  /** Základní cena v měně země; `null`, když cena chybí nebo je počítaná. */
  amount: number | null
  /** Nejnižší hodnota košíku, od které je doprava zdarma (`null` = nikdy). */
  free_from: number | null
  /** Všechny podmíněné sazby (pro úplnost; `free_from` je z nich odvozené). */
  tiers: PriceTier[]
}

export type PublicCountryPrices = {
  country_code: string
  currency_code: string
  region_id: string
  options: PublicShippingOption[]
}

const OPERATORS = new Set(["gt", "gte", "lt", "lte", "eq"])

/** Hodnoty pravidel ukládá Medusa jako JSON — `"true"` i `true` je totéž. */
const ruleValue = (value: unknown): string =>
  String(value ?? "")
    .replace(/^"+|"+$/g, "")
    .trim()
    .toLowerCase()

const toAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "object" && value !== null && "value" in (value as any)) {
    return toAmount((value as any).value)
  }
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

/** Je možnost vidět v obchodě a není to vratka? */
export const isPublicOption = (option: RawShippingOption): boolean => {
  const rules = option.rules ?? []
  const has = (attribute: string, expected: string) =>
    rules.some(
      (rule) => rule.attribute === attribute && ruleValue(rule.value) === expected
    )
  if (has("is_return", "true")) return false
  if (has("enabled_in_store", "false")) return false
  return true
}

const regionRuleOf = (price: RawPrice) =>
  (price.price_rules ?? []).find((rule) => rule.attribute === "region_id")

const itemTotalRulesOf = (price: RawPrice) =>
  (price.price_rules ?? []).filter((rule) => rule.attribute === "item_total")

/**
 * Ceny jedné možnosti pro jeden region: základní cena + podmíněné sazby.
 * Cena vázaná na jiný region se ignoruje; vázaná na tento region vyhrává.
 */
export const pricesForRegion = (
  option: RawShippingOption,
  region: RawRegion
): { amount: number | null; tiers: PriceTier[] } => {
  const currency = String(region.currency_code ?? "").toLowerCase()
  const candidates = (option.prices ?? []).filter((price) => {
    if (String(price.currency_code ?? "").toLowerCase() !== currency) return false
    const regionRule = regionRuleOf(price)
    return !regionRule || ruleValue(regionRule.value) === region.id.toLowerCase()
  })

  const base = candidates.filter((price) => itemTotalRulesOf(price).length === 0)
  const preferred =
    base.find((price) => regionRuleOf(price)) ?? base.find((price) => !regionRuleOf(price))

  const tiers: PriceTier[] = []
  for (const price of candidates) {
    const amount = toAmount(price.amount)
    if (amount === null) continue
    for (const rule of itemTotalRulesOf(price)) {
      const operator = String(rule.operator ?? "").toLowerCase()
      const value = toAmount(ruleValue(rule.value))
      if (!OPERATORS.has(operator) || value === null) continue
      tiers.push({ amount, operator: operator as PriceTier["operator"], value })
    }
  }
  tiers.sort((a, b) => a.value - b.value)

  return { amount: preferred ? toAmount(preferred.amount) : null, tiers }
}

/** „Zdarma od X" — nejnižší hranice, nad kterou sazba klesne na nulu. */
export const freeFrom = (tiers: PriceTier[]): number | null => {
  const free = tiers.filter(
    (tier) => tier.amount === 0 && (tier.operator === "gte" || tier.operator === "gt")
  )
  if (!free.length) return null
  // `gt 1000` znamená „víc než 1000" — pro zákazníka je to pořád „od 1000".
  return Math.min(...free.map((tier) => tier.value))
}

/** Ceník po zemích. Země, kam nevede žádná možnost, se nevypisují. */
export const buildShippingPrices = (
  options: RawShippingOption[],
  regions: RawRegion[]
): PublicCountryPrices[] => {
  const regionByCountry: Record<string, RawRegion> = {}
  for (const region of regions) {
    for (const country of region.countries ?? []) {
      const code = String(country.iso_2 ?? "").toLowerCase()
      if (code && !regionByCountry[code]) regionByCountry[code] = region
    }
  }

  const byCountry: Record<string, PublicCountryPrices> = {}
  const order: string[] = []

  for (const option of options.filter(isPublicOption)) {
    const countries = (option.service_zone?.geo_zones ?? [])
      .map((zone) => String(zone.country_code ?? "").toLowerCase())
      .filter(Boolean)
    const unique = countries.filter((code, index) => countries.indexOf(code) === index)

    for (const code of unique) {
      const region = regionByCountry[code]
      if (!region) continue
      const { amount, tiers } = pricesForRegion(option, region)
      const calculated = option.price_type === "calculated"
      // Pevná možnost bez ceny v měně země v pokladně nejde zvolit — nevypisovat.
      if (!calculated && amount === null && !tiers.length) continue

      if (!byCountry[code]) {
        byCountry[code] = {
          country_code: code,
          currency_code: String(region.currency_code ?? "").toLowerCase(),
          region_id: region.id,
          options: [],
        }
        order.push(code)
      }

      byCountry[code].options.push({
        id: option.id,
        name: String(option.name ?? "").trim() || "Doprava",
        type: option.service_zone?.fulfillment_set?.type === "pickup" ? "pickup" : "shipping",
        price_type: calculated ? "calculated" : "flat",
        amount: calculated ? null : amount,
        free_from: freeFrom(tiers),
        tiers,
      })
    }
  }

  // Česko první, pak ostatní abecedně; uvnitř země od nejlevnější možnosti.
  order.sort((a, b) => (a === "cz" ? -1 : b === "cz" ? 1 : a.localeCompare(b)))
  return order.map((code) => {
    const country = byCountry[code]
    country.options.sort((a, b) => {
      if (a.type !== b.type) return a.type === "pickup" ? 1 : -1
      return (a.amount ?? Number.MAX_SAFE_INTEGER) - (b.amount ?? Number.MAX_SAFE_INTEGER)
    })
    return country
  })
}
