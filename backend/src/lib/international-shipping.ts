import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { fetchCnbRates, type CnbRateSheet } from "./cnb-rates"
import { getMerchantSettings, setMerchantSettings } from "./merchant-settings"
import {
  CP_SERVICE_DEFAULT,
  cpAllQuotes,
  cpCountryName,
  cpFetchedAt,
  cpServices,
  cpShipsTo,
} from "./cp-kalkulacka"
import {
  INTERNATIONAL_DEFAULT_OFF,
  INTERNATIONAL_OPTION_ID,
  INTERNATIONAL_OPTION_NAME,
  INTERNATIONAL_SERVICE_CODE,
  INTERNATIONAL_ZONE_NAME,
  internationalQuoteFor,
  isInternationalOptionData,
  normalizePricesCzk,
  type InternationalOptionData,
  type InternationalQuote,
} from "./international-shipping-price"

/**
 * Česká pošta – na adresu zahraničí (19. 11. 2026, docs/cp-kalkulacka/PLAN.md).
 *
 * - **Jedna volba dopravy** (poskytovatel `ceska-posta-fulfillment`,
 *   `price_type: calculated`) ve vlastní zóně „Zahraničí" pod stejnou sadou
 *   plnění jako tuzemská ČP. Vznikne prvním uložením v administraci
 *   (Nastavení obchodu › Doprava a platba).
 * - **Cena se počítá v pokladně** (`calculatePrice` dopravce): hmotnost
 *   košíku → ceník ČP (`lib/cp-kalkulacka`) → kurz ČNB. Vše, co k tomu
 *   výpočet potřebuje, je v datech volby: povolené země, služba, průměrná
 *   váha, obal, ruční ceny, měna podle země a kurzy. Dopravce do nastavení
 *   obchodu ani do regionů nevidí.
 * - **Geo zóny = povolené země**, kam ČP balík vozí (nebo kde je ruční cena).
 * - **Kurz** obnovuje denně `jobs/sync-currency-prices`.
 */

export {
  INTERNATIONAL_SERVICE_CODE,
  INTERNATIONAL_OPTION_NAME,
  INTERNATIONAL_ZONE_NAME,
  isInternationalOptionData,
  normalizePricesCzk,
} from "./international-shipping-price"
export type { InternationalOptionData } from "./international-shipping-price"

const markupPercent = () => Number(process.env.CNB_PRICE_MARKUP_PERCENT ?? 0) || 0

type CountryRow = { country_code: string; currency_code: string; region: string; display_name: string }

/** Země, kam se dá prodávat mimo Česko — ze všech regionů obchodu. */
export const listForeignCountries = async (container: MedusaContainer): Promise<CountryRow[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2", "countries.display_name"],
  })
  const rows: CountryRow[] = []
  for (const region of regions as any[]) {
    for (const country of region.countries ?? []) {
      const code = String(country.iso_2 ?? "").toLowerCase()
      if (!code || code === "cz") continue
      rows.push({
        country_code: code,
        currency_code: String(region.currency_code).toLowerCase(),
        region: region.name,
        display_name: cpCountryName(code),
      })
    }
  }
  return rows.sort((a, b) => a.display_name.localeCompare(b.display_name, "cs"))
}

type ExistingOption = { id: string; data: Record<string, unknown> | null; service_zone_id: string }

const findInternationalOption = async (container: MedusaContainer): Promise<ExistingOption | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "data", "service_zone_id"],
  })
  const found = (options as any[]).find((option) => isInternationalOptionData(option.data))
  return found ? { id: found.id, data: found.data, service_zone_id: found.service_zone_id } : null
}

/** Zóna a volba — najde, nebo založí vedle tuzemské České pošty. */
const ensureInternationalOption = async (
  container: MedusaContainer,
  data: InternationalOptionData
): Promise<ExistingOption> => {
  const existing = await findInternationalOption(container)
  if (existing) return existing

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "data", "provider_id", "shipping_profile_id", "service_zone.fulfillment_set_id"],
  })
  const isCp = (option: any) => String(option.provider_id ?? "").startsWith("ceska-posta-fulfillment")
  const domestic =
    (options as any[]).find((option) => isCp(option) && (option.data as any)?.id === "cp-address") ??
    (options as any[]).find((option) => isCp(option) && !isInternationalOptionData(option.data))
  const fulfillmentSetId = domestic?.service_zone?.fulfillment_set_id
  if (!domestic || !fulfillmentSetId) {
    throw new Error("Nenašla jsem tuzemskou Českou poštu, ke které bych dopravu do zahraničí připojila.")
  }

  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const zones: any[] = await fulfillment.listServiceZones({ fulfillment_set_id: fulfillmentSetId })
  const zone =
    zones.find((item) => item.name === INTERNATIONAL_ZONE_NAME) ??
    (await fulfillment.createServiceZones({
      name: INTERNATIONAL_ZONE_NAME,
      fulfillment_set_id: fulfillmentSetId,
      geo_zones: [],
    }))

  const { result } = await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: INTERNATIONAL_OPTION_NAME,
        price_type: "calculated",
        provider_id: domestic.provider_id,
        service_zone_id: zone.id,
        shipping_profile_id: domestic.shipping_profile_id,
        type: {
          label: "Do zahraničí",
          description: "Česká pošta – balík na adresu do zahraničí",
          code: "international",
        },
        data: data as unknown as Record<string, unknown>,
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      } as any,
    ],
  })
  const created = (result as any[])[0]
  return { id: created.id, data: created.data, service_zone_id: zone.id }
}

/** Geo zóny „Zahraničí" = přesně zadané země. */
const syncGeoZones = async (container: MedusaContainer, serviceZoneId: string, countries: string[]) => {
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const current: any[] = await fulfillment.listGeoZones({ service_zone_id: serviceZoneId })
  const wanted = new Set(countries)
  const stale = current.filter(
    (zone) => zone.type !== "country" || !wanted.has(String(zone.country_code).toLowerCase())
  )
  if (stale.length) await fulfillment.deleteGeoZones(stale.map((zone) => zone.id))
  const have = new Set(
    current.filter((zone) => zone.type === "country").map((zone) => String(zone.country_code).toLowerCase())
  )
  const missing = countries.filter((code) => !have.has(code))
  if (missing.length) {
    await fulfillment.createGeoZones(
      missing.map((country_code) => ({ service_zone_id: serviceZoneId, type: "country", country_code }))
    )
  }
}

const writeOptionData = async (container: MedusaContainer, optionId: string, data: InternationalOptionData) => {
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  // I název — starší volba „do zahraničí" (pevná cena po zemích) dostane nový.
  await fulfillment.updateShippingOptions(optionId, { name: INTERNATIONAL_OPTION_NAME, data })
}

/** Kurzy z lístku ČNB pro měny zemí (kromě koruny). */
const ratesFor = (currencies: string[], sheet: CnbRateSheet | null) => {
  const out: Record<string, { amount: number; rate: number }> = {}
  for (const currency of currencies) {
    const code = currency.toUpperCase()
    if (code === "CZK") continue
    const rate = sheet?.rates.get(code)
    if (rate) out[code] = { amount: rate.amount, rate: rate.rate }
  }
  return out
}

export type InternationalCountryState = CountryRow & {
  enabled: boolean
  /** Vozí ČP do země balík vůbec? */
  cp_ships: boolean
  override_czk: number | null
  /** Cena pro průměrnou váhu (jak by ji viděl zákazník bez vyplněných hmotností). */
  quote: InternationalQuote | null
}

export type InternationalShippingState = {
  option_id: string | null
  rates_date: string | null
  fetched_at: string
  services: string[]
  service: string
  parcel_weight_kg: number
  packaging_kg: number
  countries: InternationalCountryState[]
}

/** Data volby, jak by vypadala z nastavení a zemí (bez uložení). */
const buildData = (input: {
  countries: string[]
  overrides_czk: Record<string, number>
  service: string
  parcel_weight_kg: number
  packaging_kg: number
  rows: CountryRow[]
  rates: Record<string, { amount: number; rate: number }>
  rates_date: string | null
}): InternationalOptionData => ({
  id: INTERNATIONAL_OPTION_ID,
  service_code: INTERNATIONAL_SERVICE_CODE,
  international: true,
  countries: input.countries,
  overrides_czk: input.overrides_czk,
  service: input.service,
  parcel_weight_kg: input.parcel_weight_kg,
  packaging_kg: input.packaging_kg,
  currency_by_country: Object.fromEntries(input.rows.map((row) => [row.country_code, row.currency_code])),
  rates: input.rates,
  rates_date: input.rates_date,
  markup_percent: markupPercent(),
})

export const getInternationalShipping = async (
  container: MedusaContainer
): Promise<InternationalShippingState> => {
  const [rows, option, settings] = await Promise.all([
    listForeignCountries(container),
    findInternationalOption(container),
    getMerchantSettings(container),
  ])
  const stored = (option?.data ?? null) as InternationalOptionData | null
  const service = settings.international_cp_service || CP_SERVICE_DEFAULT
  const parcelWeight = settings.international_parcel_weight_kg
  const packaging = settings.international_packaging_kg ?? 0
  // Před prvním uložením: všechny země, kam ČP vozí, kromě GB (celní prohlášení).
  const enabled = new Set(
    stored?.countries ??
      rows
        .filter((row) => cpShipsTo(row.country_code) && !INTERNATIONAL_DEFAULT_OFF.includes(row.country_code))
        .map((row) => row.country_code)
  )
  const preview = buildData({
    countries: rows.map((row) => row.country_code),
    overrides_czk: stored?.overrides_czk ?? {},
    service,
    parcel_weight_kg: parcelWeight,
    packaging_kg: packaging,
    rows,
    rates: stored?.rates ?? {},
    rates_date: stored?.rates_date ?? null,
  })
  return {
    option_id: option?.id ?? null,
    rates_date: stored?.rates_date ?? null,
    fetched_at: cpFetchedAt(),
    services: cpServices(),
    service,
    parcel_weight_kg: parcelWeight,
    packaging_kg: packaging,
    countries: rows.map((row) => ({
      ...row,
      enabled: enabled.has(row.country_code),
      cp_ships: cpShipsTo(row.country_code),
      override_czk: stored?.overrides_czk?.[row.country_code] ?? null,
      quote: internationalQuoteFor(preview, row.country_code, parcelWeight),
    })),
  }
}

export type SaveInternationalInput = {
  countries?: unknown
  overrides_czk?: unknown
  service?: unknown
  parcel_weight_kg?: unknown
  packaging_kg?: unknown
}

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

/** Uloží nastavení z administrace: nastavení obchodu + data volby + země zóny. */
export const saveInternationalShipping = async (
  container: MedusaContainer,
  input: SaveInternationalInput
): Promise<InternationalShippingState> => {
  const rows = await listForeignCountries(container)
  const known = new Set(rows.map((row) => row.country_code))

  const service = String(input.service ?? CP_SERVICE_DEFAULT)
  if (!cpServices().includes(service)) throw invalid("Neznámá služba České pošty.")
  const parcelWeight = Number(String(input.parcel_weight_kg ?? "").replace(",", "."))
  if (!(parcelWeight > 0 && parcelWeight <= 30)) throw invalid("Průměrná váha balíku musí být od 0,1 do 30 kg.")
  const packaging = Number(String(input.packaging_kg ?? 0).replace(",", ".")) || 0
  if (!(packaging >= 0 && packaging <= 10)) throw invalid("Obal musí být od 0 do 10 kg.")

  const overrides = Object.fromEntries(
    Object.entries(normalizePricesCzk(input.overrides_czk)).filter(([code]) => known.has(code))
  )
  const requested = Array.isArray(input.countries)
    ? [...new Set((input.countries as unknown[]).map((code) => String(code).trim().toLowerCase()))]
    : []
  // Posílat jde jen tam, kam ČP balík vozí — nebo kde majitelka zadala vlastní cenu.
  const countries = requested.filter((code) => known.has(code) && (cpShipsTo(code) || overrides[code]))

  await setMerchantSettings(container, {
    international_cp_service: service,
    international_parcel_weight_kg: Math.round(parcelWeight * 10) / 10,
    international_packaging_kg: Math.round(packaging * 10) / 10,
  } as never)

  const currencies = [...new Set(rows.filter((row) => countries.includes(row.country_code)).map((row) => row.currency_code))]
  const sheet = currencies.some((currency) => currency !== "czk") ? await fetchCnbRates() : null
  const data = buildData({
    countries,
    overrides_czk: overrides,
    service,
    parcel_weight_kg: Math.round(parcelWeight * 10) / 10,
    packaging_kg: Math.round(packaging * 10) / 10,
    rows,
    rates: ratesFor(currencies, sheet),
    rates_date: sheet?.date ?? null,
  })
  const option = await ensureInternationalOption(container, data)
  await writeOptionData(container, option.id, data)
  await syncGeoZones(container, option.service_zone_id, countries)
  return getInternationalShipping(container)
}

/** Denní přepočet kurzem ČNB (volá `sync-currency-prices`). Vrací počet zemí. */
export const refreshInternationalShippingRates = async (
  container: MedusaContainer,
  sheet: CnbRateSheet
): Promise<number> => {
  const option = await findInternationalOption(container)
  if (!option) return 0
  const data = option.data as unknown as InternationalOptionData
  const rows = await listForeignCountries(container)
  const countries = (data.countries ?? []).filter((code) => rows.some((row) => row.country_code === code))
  const currencies = [...new Set(rows.filter((row) => countries.includes(row.country_code)).map((row) => row.currency_code))]
  await writeOptionData(
    container,
    option.id,
    buildData({
      countries,
      overrides_czk: data.overrides_czk ?? {},
      service: data.service || CP_SERVICE_DEFAULT,
      parcel_weight_kg: data.parcel_weight_kg || 3,
      packaging_kg: data.packaging_kg ?? 0,
      rows,
      rates: ratesFor(currencies, sheet),
      rates_date: sheet.date,
    })
  )
  return countries.length
}

/** Malá kalkulačka pro administraci: všechny služby ČP pro zemi a váhu. */
export const internationalCalculator = (country: string, kg: number) => ({
  country: String(country).toLowerCase(),
  name: cpCountryName(country),
  kg,
  quotes: cpAllQuotes(country, kg),
})
