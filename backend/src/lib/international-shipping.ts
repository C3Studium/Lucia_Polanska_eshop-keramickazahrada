import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { fetchCnbRates, type CnbRateSheet } from "./cnb-rates"
import { getMerchantSettings, setMerchantSettings } from "./merchant-settings"
import { LINE_QUANTITY_FIELDS, lineQuantityOf } from "./order-quantity"
import { rozdilCeniku, stahniCenikCp } from "./cp-kalkulacka/zive"
import { notifyMerchant } from "./notify"
import {
  cpAllQuotes,
  cpCheapest,
  cpTiers,
  type CpQuote,
  type CpZiveTabulka,
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
  internationalMethodName,
  internationalQuoteFor,
  internationalQuoteForItems,
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
  /** Ceník ČP v Kč pro průměrnou váhu (i před uložením a bez kurzu). */
  cp: CpQuote | null
}

export type InternationalShippingState = {
  option_id: string | null
  rates_date: string | null
  fetched_at: string
  /** `zive` = stažený z kalkulačky ČP, `tabulka` = záloha z 19. 11. 2026. */
  cenik_zdroj: "zive" | "tabulka"
  cenik_stav: InternationalOptionData["cenik_stav"]
  /** Všechny služby v ceníku ČP. */
  all_services: string[]
  /** Povolené služby — vybírá se z nich nejlevnější. */
  services: string[]
  parcel_weight_kg: number
  packaging_kg: number
  countries: InternationalCountryState[]
}

/** Data volby, jak by vypadala z nastavení a zemí (bez uložení). */
const buildData = (input: {
  countries: string[]
  overrides_czk: Record<string, number>
  services: string[]
  parcel_weight_kg: number
  packaging_kg: number
  rows: CountryRow[]
  rates: Record<string, { amount: number; rate: number }>
  rates_date: string | null
  cenik_zive?: InternationalOptionData["cenik_zive"]
  cenik_stav?: InternationalOptionData["cenik_stav"]
}): InternationalOptionData => ({
  id: INTERNATIONAL_OPTION_ID,
  service_code: INTERNATIONAL_SERVICE_CODE,
  international: true,
  countries: input.countries,
  overrides_czk: input.overrides_czk,
  services: input.services,
  parcel_weight_kg: input.parcel_weight_kg,
  packaging_kg: input.packaging_kg,
  currency_by_country: Object.fromEntries(input.rows.map((row) => [row.country_code, row.currency_code])),
  rates: input.rates,
  rates_date: input.rates_date,
  markup_percent: markupPercent(),
  cenik_zive: input.cenik_zive ?? null,
  cenik_stav: input.cenik_stav ?? null,
})

/**
 * Stav pro administraci. `nahled` = co majitelka právě píše (váha, služba)
 * — ceny v tabulce se tak mění hned, ne až po uložení (19. 11. 2026).
 */
export const getInternationalShipping = async (
  container: MedusaContainer,
  nahled: { kg?: number | null; services?: string[] | null } = {}
): Promise<InternationalShippingState> => {
  const [rows, option, settings] = await Promise.all([
    listForeignCountries(container),
    findInternationalOption(container),
    getMerchantSettings(container),
  ])
  const stored = (option?.data ?? null) as InternationalOptionData | null
  const services = (
    nahled.services?.length ? nahled.services : settings.international_cp_services ?? []
  ).filter((name) => cpServices().includes(name))
  const parcelWeight =
    nahled.kg && nahled.kg > 0 && nahled.kg <= 30 ? nahled.kg : settings.international_parcel_weight_kg
  const packaging = settings.international_packaging_kg ?? 0
  // Před prvním uložením: všechny země, kam ČP vozí, kromě GB (celní prohlášení).
  const enabled = new Set(
    stored?.countries ??
      rows
        .filter((row) => cpShipsTo(row.country_code) && !INTERNATIONAL_DEFAULT_OFF.includes(row.country_code))
        .map((row) => row.country_code)
  )
  /* Před prvním uložením kurz ještě v datech volby není — vezme se dnešní
     z ČNB, ať tabulka ukáže i eura (bez kurzu aspoň koruny). */
  let rates = stored?.rates ?? {}
  let ratesDate = stored?.rates_date ?? null
  if (!Object.keys(rates).length) {
    const currencies = [...new Set(rows.map((row) => row.currency_code))]
    const sheet = await fetchCnbRates().catch(() => null)
    rates = ratesFor(currencies, sheet)
    ratesDate = sheet?.date ?? null
  }
  const preview = buildData({
    countries: rows.map((row) => row.country_code),
    overrides_czk: stored?.overrides_czk ?? {},
    services,
    parcel_weight_kg: parcelWeight,
    packaging_kg: packaging,
    rows,
    rates,
    rates_date: ratesDate,
    cenik_zive: stored?.cenik_zive ?? null,
  })
  return {
    option_id: option?.id ?? null,
    rates_date: ratesDate,
    /* Ceník: živě stažený (každou noc v 1:00), jinak tabulka z 19. 11. 2026. */
    fetched_at: stored?.cenik_zive?.fetched_at ?? cpFetchedAt(),
    cenik_zdroj: stored?.cenik_zive ? "zive" : "tabulka",
    cenik_stav: stored?.cenik_stav ?? null,
    all_services: cpServices(),
    services,
    parcel_weight_kg: parcelWeight,
    packaging_kg: packaging,
    countries: rows.map((row) => ({
      ...row,
      enabled: enabled.has(row.country_code),
      cp_ships: cpShipsTo(row.country_code, stored?.cenik_zive?.countries),
      override_czk: stored?.overrides_czk?.[row.country_code] ?? null,
      quote: internationalQuoteFor(preview, row.country_code, parcelWeight),
      /* Cena z ceníku ČP v Kč i bez kurzu a bez ruční ceny — pro sloupec „Ceník ČP". */
      cp: cpShipsTo(row.country_code, stored?.cenik_zive?.countries)
        ? cpCheapest(row.country_code, parcelWeight, services, stored?.cenik_zive?.countries)
        : null,
    })),
  }
}

export type SaveInternationalInput = {
  countries?: unknown
  overrides_czk?: unknown
  services?: unknown
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

  const services = Array.isArray(input.services)
    ? [...new Set((input.services as unknown[]).map(String))].filter((name) => cpServices().includes(name))
    : cpServices()
  if (!services.length) throw invalid("Vyberte aspoň jednu službu České pošty.")
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
    international_cp_services: services,
    international_parcel_weight_kg: Math.round(parcelWeight * 10) / 10,
    international_packaging_kg: Math.round(packaging * 10) / 10,
  } as never)

  const currencies = [...new Set(rows.filter((row) => countries.includes(row.country_code)).map((row) => row.currency_code))]
  const sheet = currencies.some((currency) => currency !== "czk") ? await fetchCnbRates() : null
  const data = buildData({
    countries,
    overrides_czk: overrides,
    services,
    parcel_weight_kg: Math.round(parcelWeight * 10) / 10,
    packaging_kg: Math.round(packaging * 10) / 10,
    rows,
    rates: ratesFor(currencies, sheet),
    rates_date: sheet?.date ?? null,
  })
  const existing = (await findInternationalOption(container))?.data as InternationalOptionData | null | undefined
  data.cenik_zive = existing?.cenik_zive ?? null
  data.cenik_stav = existing?.cenik_stav ?? null
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
      services: data.services ?? [],
      parcel_weight_kg: data.parcel_weight_kg || 3,
      packaging_kg: data.packaging_kg ?? 0,
      rows,
      rates: ratesFor(currencies, sheet),
      rates_date: sheet.date,
      cenik_zive: data.cenik_zive ?? null,
      cenik_stav: data.cenik_stav ?? null,
    })
  )
  return countries.length
}

/** Malá kalkulačka pro administraci: všechny služby ČP pro zemi a váhu. */
export const internationalCalculator = async (container: MedusaContainer, country: string, kg: number) => {
  const option = await findInternationalOption(container)
  const zive = (option?.data as InternationalOptionData | null | undefined)?.cenik_zive?.countries
  return {
    country: String(country).toLowerCase(),
    name: cpCountryName(country),
    kg,
    quotes: cpAllQuotes(country, kg, zive),
  }
}

/** Tabulka zálohy (z 19. 11. 2026) pro zemi — srovnání se staženými cenami. */
const zalohaZeme = (country: string): Record<string, Array<[number, number]>> =>
  Object.fromEntries(
    cpServices()
      .map((service) => [service, cpTiers(country, service)] as const)
      .filter(([, tiers]) => tiers.length > 0)
  )

let beziObnova: Promise<ObnovaCenikuVysledek> | null = null

export type ObnovaCenikuVysledek = {
  stav: "ok" | "chyby" | "bez-volby" | "bezi"
  stazeno: string[]
  chyby: Array<{ country: string; chyba: string }>
  zmen: number
}

/**
 * Noční obnova ceníku ČP (19. 11. 2026, Matěj): stáhne ceny všech služeb a vah
 * pro země obchodu z kalkulačky postaonline.cz a uloží je k volbě dopravy.
 *
 * - Země stažená celá se přepíše; země s chybou si NECHÁ poslední data
 *   (nebo tabulku z 19. 11.) — pokladna počítá dál.
 * - Když se cokoli nepodaří, přijde vývojáři e-mail hned (ne souhrnem).
 * - Když se ceny změnily, přijde vývojáři e-mail se seznamem změn.
 * - Běží jen jednou naráz (ruční spuštění během nočního běhu nic nezdvojí).
 */
export const obnovCenikCp = async (container: MedusaContainer): Promise<ObnovaCenikuVysledek> => {
  if (beziObnova) return { stav: "bezi", stazeno: [], chyby: [], zmen: 0 }
  beziObnova = (async (): Promise<ObnovaCenikuVysledek> => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const option = await findInternationalOption(container)
    if (!option) {
      logger.info("[cp-cenik] Doprava do zahraničí ještě není uložená — ceník se nestahuje.")
      return { stav: "bez-volby", stazeno: [], chyby: [], zmen: 0 }
    }
    const rows = await listForeignCountries(container)
    const countries = [...new Set(rows.map((row) => row.country_code))]
    const start = Date.now()
    const vysledek = await stahniCenikCp(countries, { log: (zprava) => logger.info(zprava) })

    /* Znovu načíst data volby — během ~12 min mohla majitelka uložit nastavení. */
    const aktualni = ((await findInternationalOption(container))?.data ?? option.data) as InternationalOptionData
    const predtim: CpZiveTabulka = aktualni.cenik_zive?.countries ?? {}
    const srovnani: CpZiveTabulka = Object.fromEntries(
      Object.keys(vysledek.zeme).map((country) => [country, predtim[country] ?? zalohaZeme(country)])
    )
    const rozdil = rozdilCeniku(srovnani, vysledek.zeme)
    const ted = new Date().toISOString()
    const stazeno = Object.keys(vysledek.zeme)
    const data: InternationalOptionData = {
      ...aktualni,
      cenik_zive: stazeno.length
        ? { fetched_at: ted, countries: { ...predtim, ...vysledek.zeme } }
        : aktualni.cenik_zive ?? null,
      cenik_stav: { checked_at: ted, ok: vysledek.chyby.length === 0, chyby: vysledek.chyby },
    }
    await writeOptionData(container, option.id, data)
    logger.info(
      `[cp-cenik] Hotovo za ${Math.round((Date.now() - start) / 1000)} s: staženo ${stazeno.length}/${countries.length} zemí, chyb ${vysledek.chyby.length}, změněných cen ${rozdil.pocet}.`
    )

    const den = ted.slice(0, 10)
    if (vysledek.chyby.length) {
      await posliChybuCeniku(container, {
        klic: `cp-cenik-chyba:${den}`,
        chyby: vysledek.chyby,
        zemi: countries.length,
        posledniStazeni: aktualni.cenik_zive?.fetched_at ?? null,
      })
    }
    if (rozdil.pocet) {
      await notifyMerchant(container, {
        key: `cp-cenik-zmena:${den}`,
        title: `Česká pošta změnila ceník do zahraničí (${rozdil.pocet} cen)`,
        description: rozdil.ukazka.join("\n") + (rozdil.pocet > rozdil.ukazka.length ? "\n…" : "") +
          "\n\nPokladna už počítá s novými cenami.",
        audience: "dev",
        email: true,
        souhrn: true,
      }).catch(() => undefined)
    }
    return { stav: vysledek.chyby.length ? "chyby" : "ok", stazeno, chyby: vysledek.chyby, zmen: rozdil.pocet }
  })()
  try {
    return await beziObnova
  } finally {
    beziObnova = null
  }
}

/**
 * E-mail vývojáři, když se ceník nepodařilo stáhnout — hned, ne souhrnem.
 * Sdílí ho noční běh i zkušební odeslání z administrace (`zkouska`).
 */
export const posliChybuCeniku = async (
  container: MedusaContainer,
  input: {
    klic: string
    chyby: Array<{ country: string; chyba: string }>
    zemi: number
    posledniStazeni: string | null
    zkouska?: boolean
  }
) => {
  const posledni = input.posledniStazeni
    ? new Date(input.posledniStazeni).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })
    : "tabulky z 19. 11. 2026"
  return notifyMerchant(container, {
    key: input.klic,
    title:
      (input.zkouska ? "[ZKOUŠKA] " : "") +
      `Ceník České pošty do zahraničí se nepodařilo stáhnout (${input.chyby.length} z ${input.zemi} zemí)`,
    description:
      (input.zkouska
        ? "Tohle je zkušební e-mail — takhle bude vypadat upozornění, když noční stažení ceníku selže. Nic se nestalo.\n\n"
        : "") +
      input.chyby.map((item) => `${item.country.toUpperCase()}: ${item.chyba}`).join("\n") +
      `\n\nPokladna dál počítá dopravu do těchto zemí z posledních dat (${posledni}). ` +
      `Další pokus proběhne příští noc v 1:00, nebo ručně v Nastavení obchodu › Doprava a platba › „Stáhnout ceník teď“.`,
    audience: "dev",
    urgent: true,
    email: true,
    souhrn: true,
  }).catch(() => undefined)
}

/** Běží zrovna stahování ceníku? (administrace ukáže „stahuje se…") */
export const cenikSeStahuje = (): boolean => beziObnova !== null

/**
 * Název dopravy OBJEDNÁVKY podle vybrané služby ČP (19. 11. 2026, Matěj:
 * „ukázat název služby v obchodě, objednávce i PDF, ať to zákazník i admin ví").
 *
 * Košík název nese jen dočasně — Medusa při každé úpravě košíku vrátí dopravě
 * název volby (refreshCartShippingMethods), a objednávku po ComGate dokončí
 * notifikace bez dalšího čtení košíku. Proto se název srovná na objednávce:
 * při jejím založení a ještě před skládáním potvrzovacího e-mailu s PDF a
 * faktury (na pořadí odběratelů tak nezáleží). Idempotentní; nic nevyhazuje.
 * Výpočet je týž jako cena v pokladně (razítka hmotnosti na řádcích).
 */
export const ensureInternationalOrderMethodName = async (
  container: MedusaContainer,
  orderId: string
): Promise<string | null> => {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "shipping_address.country_code",
        "items.id",
        "items.product_id",
        "items.variant_id",
        "items.metadata",
        ...LINE_QUANTITY_FIELDS,
        "shipping_methods.id",
        "shipping_methods.name",
        "shipping_methods.shipping_option_id",
      ],
      filters: { id: orderId },
    })
    const order = (data as any[])[0]
    const methods = ((order?.shipping_methods ?? []) as any[]).filter((method) => method?.shipping_option_id)
    if (!methods.length) return null
    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "data"],
      filters: { id: [...new Set(methods.map((method) => method.shipping_option_id))] },
    })
    const dataById = new Map((options as any[]).map((option) => [option.id, option.data]))
    const items = ((order.items ?? []) as any[]).map((item) => ({ ...item, quantity: lineQuantityOf(item) }))
    for (const method of methods) {
      const optionData = dataById.get(method.shipping_option_id)
      if (!isInternationalOptionData(optionData)) continue
      const name = internationalMethodName(
        internationalQuoteForItems(optionData, order.shipping_address?.country_code, items)
      )
      if (name !== method.name) {
        const orderModule: any = container.resolve(Modules.ORDER)
        await orderModule.updateOrderShippingMethods([{ id: method.id, name }])
      }
      return name
    }
    return null
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[zahraničí] Název dopravy objednávky ${orderId} se nepodařilo srovnat: ${error instanceof Error ? error.message : error}`)
    return null
  }
}
