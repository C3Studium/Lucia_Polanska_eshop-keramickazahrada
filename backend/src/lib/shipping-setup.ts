import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  DEFAULT_RATES,
  boxRates,
  rateGroupOf,
  type RateGroup,
  type ShippingRates,
} from "./shipping-rates"

/**
 * Volby dopravy České pošty — nastavení podle druhů (17. 11. 2026, Matěj).
 *
 * Čtyři samostatné volby, každá svou cenou (lib/shipping-rates):
 *
 * | volba (data.id)     | ceny                       | křehké | dobírka |
 * | cp-address          | malá / velká               | ano    | ano     |
 * | balikovna-address   | malá / velká               | ano    | ano     |
 * | balikovna (BOX)     | jedna cena                 | ne     | ne      |
 * | cp-letter (dopis)   | jedna cena, jen poukazy    | —      | ne      |
 *
 * Samostatná „Česká Pošta - Křehké" skončila: křehké je příplatek k běžné
 * volbě. Původně to dělala migrace v \`predeploy\` — jenže Railway ten krok
 * nespouští, takže nastavení dopravy zůstalo na pevných cenách a uložení
 * v adminu nemělo kam zapsat. Proto se nastavení dorovná při uložení
 * cen (POST /admin/shipping-rates) a umí to i skript. Opakovatelné —
 * dělá jen to, co chybí.
 */

export const LETTER_OPTION_ID = "cp-letter"
export const ADDRESS_BALIKOVNA_ID = "balikovna-address"

const isCp = (option: any) => String(option?.provider_id ?? "").includes("ceska-posta")

/*
 * Jen tyhle druhy se tu spravují. Jiné volby téhož poskytovatele (doprava
 * do zahraničí, Slovensko…) mají vlastní ceník a nesmí dostat domácí ceny
 * — změřeno v sandboxu 17. 11. 2026, kde „do zahraničí" jinak přešla na
 * ceny České pošty.
 */
const MANAGED_IDS = ["cp-address", "balikovna", "balikovna-address", "cp-letter", "cp-fragile"]
const isManaged = (option: any) =>
  MANAGED_IDS.includes(String(option?.data?.id ?? "")) &&
  !/slovensk|zahrani/i.test(
    String(option?.name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  )

export const listCpOptions = async (container: MedusaContainer): Promise<any[]> => {
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const options: any[] = await fulfillment.listShippingOptions(
    {},
    { take: 500, relations: ["rules", "type"] }
  )
  return options.filter((option) => isCp(option) && isManaged(option))
}

const copyOf = (template: any, name: string, data: Record<string, unknown>) => ({
  name,
  price_type: "calculated" as const,
  service_zone_id: template.service_zone_id,
  shipping_profile_id: template.shipping_profile_id,
  provider_id: template.provider_id,
  type: {
    label: template.type?.label ?? "Standard",
    description: template.type?.description ?? "",
    code: template.type?.code ?? "standard",
  },
  data,
  rules: (template.rules ?? []).map((rule: any) => ({
    attribute: rule.attribute,
    operator: rule.operator,
    value: rule.value,
  })),
})

export type ShippingSetupResult = {
  created: string[]
  removed: string[]
  switched: string[]
}

/** Dorovná volby dopravy na čtyři druhy (viz nahoře). */
export const ensureShippingSetup = async (
  container: MedusaContainer
): Promise<ShippingSetupResult> => {
  const result: ShippingSetupResult = { created: [], removed: [], switched: [] }
  let options = await listCpOptions(container)

  const fragile = options.filter((option) => option.data?.id === "cp-fragile")
  if (fragile.length) {
    await deleteShippingOptionsWorkflow(container).run({
      input: { ids: fragile.map((option) => option.id) },
    })
    result.removed.push(...fragile.map((option) => option.name))
    options = options.filter((option) => option.data?.id !== "cp-fragile")
  }

  const template =
    options.find((option) => option.data?.id === "balikovna") ??
    options.find((option) => option.data?.id === "cp-address")
  if (template) {
    const missing: any[] = []
    if (!options.some((option) => option.data?.id === ADDRESS_BALIKOVNA_ID)) {
      missing.push(
        copyOf(template, "Balíkovna na adresu", {
          id: ADDRESS_BALIKOVNA_ID,
          name: "Balíkovna – na adresu",
          // Kód služby u ČP podle smlouvy — viz getFulfillmentOptions v poskytovateli.
          service_code: process.env.BALIKOVNA_ADDRESS_SERVICE_CODE || "DR",
          rates: DEFAULT_RATES.balikovna_adresa,
        })
      )
    }
    if (!options.some((option) => option.data?.id === LETTER_OPTION_ID)) {
      missing.push(
        copyOf(template, "Česká pošta – dopis (jen poukazy)", {
          id: LETTER_OPTION_ID,
          name: "Česká pošta – dopis",
          // Doporučené psaní; kód podle smlouvy (CP_LETTER_SERVICE_CODE).
          service_code: process.env.CP_LETTER_SERVICE_CODE || "RR",
          letter: true,
          rates: boxRates(DEFAULT_RATES.balikovna_box.small),
        })
      )
    }
    if (missing.length) {
      await createShippingOptionsWorkflow(container).run({ input: missing })
      result.created.push(...missing.map((option) => option.name))
      options = await listCpOptions(container)
    }
  }

  const toSwitch = options.filter(
    (option) => option.price_type !== "calculated" || !option.data?.rates
  )
  if (toSwitch.length) {
    await updateShippingOptionsWorkflow(container).run({
      input: toSwitch.map((option) => ({
        id: option.id,
        price_type: "calculated" as const,
        data: {
          ...(option.data ?? {}),
          rates: option.data?.rates ?? DEFAULT_RATES[rateGroupOf(option.data)],
        },
      })),
    })
    result.switched.push(...toSwitch.map((option) => option.name))
  }

  return result
}

/** Tabulka cen z Nastavení obchodu › Doprava a platba. */
export type RatesTable = {
  posta: { small: number; large: number; fragile: number }
  balikovna_adresa: { small: number; large: number; fragile: number }
  balikovna_box: { price: number }
  dopis: { price: number }
}

/** Ceny, které patří volbě dopravy podle jejího druhu. */
export const ratesForOption = (optionData: Record<string, unknown> | null | undefined, table: RatesTable): ShippingRates => {
  if (String(optionData?.id ?? "") === LETTER_OPTION_ID) return boxRates(table.dopis.price)
  const group: RateGroup = rateGroupOf(optionData)
  if (group === "balikovna_box") return boxRates(table.balikovna_box.price)
  const row = table[group]
  return { small: row.small, large: row.large, fragile: row.fragile, poukaz: row.small }
}

/** Současné ceny pro admin (z dat voleb, chybějící = výchozí). */
export const currentRatesTable = (options: any[]): RatesTable => {
  const of = (match: (option: any) => boolean, fallback: ShippingRates) => ({
    ...fallback,
    ...((options.find(match)?.data?.rates ?? {}) as Partial<ShippingRates>),
  })
  const posta = of((o) => o.data?.id === "cp-address", DEFAULT_RATES.posta)
  const adresa = of((o) => o.data?.id === ADDRESS_BALIKOVNA_ID, DEFAULT_RATES.balikovna_adresa)
  const box = of((o) => o.data?.id === "balikovna", DEFAULT_RATES.balikovna_box)
  const dopis = of((o) => o.data?.id === LETTER_OPTION_ID, DEFAULT_RATES.balikovna_box)
  return {
    posta: { small: posta.small, large: posta.large, fragile: Number(posta.fragile ?? 0) },
    balikovna_adresa: { small: adresa.small, large: adresa.large, fragile: Number(adresa.fragile ?? 0) },
    balikovna_box: { price: box.small },
    dopis: { price: dopis.small },
  }
}

/** Zapíše ceny do dat všech voleb České pošty (tam je čte výpočet ceny). */
export const writeRates = async (container: MedusaContainer, table: RatesTable) => {
  const options = await listCpOptions(container)
  if (!options.length) return 0
  await updateShippingOptionsWorkflow(container).run({
    input: options.map((option) => ({
      id: option.id,
      price_type: "calculated" as const,
      data: { ...(option.data ?? {}), rates: ratesForOption(option.data, table) },
    })),
  })
  return options.length
}
