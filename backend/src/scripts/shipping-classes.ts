import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  DEFAULT_RATES,
  isBalikovnaPickupOption,
  rateGroupOf,
  SHIPPING_CLASSES,
  shippingClassOf,
  type ShippingRates,
} from "../lib/shipping-rates"

/**
 * Migrace: třídy zásilek a ceny dopravy podle velikosti (16. 11. 2026, Matěj).
 *
 * Běží při každém nasazení (`predeploy`), proto je opakovatelná — dělá jen
 * to, co ještě chybí:
 *
 * 1. Výrobek bez `metadata.shipping_class` dostane třídu: dárkový poukaz
 *    `poukaz`, ostatní `male`. Velké kusy pak označí majitelka v Produkty+.
 * 2. Volby České pošty přejdou na vypočtenou cenu (velikost + příplatek za
 *    křehké, lib/shipping-rates) a dostanou výchozí ceny, pokud je ještě
 *    nemají. Pak je mění Nastavení obchodu › Doprava a platba.
 * 3. Vznikne „Balíkovna na adresu" (kopie zóny, profilu a pravidel
 *    Balíkovny) — jediná Balíkovna pro křehké zboží.
 * 4. Zmizí „Česká Pošta - Křehké": křehké je teď příplatek k běžné volbě.
 *    Objednávky, které ji mají, si nesou kopii metody — nic se jim nestane.
 *
 * Ručně:  npx medusa exec ./src/scripts/shipping-classes.ts
 */
export default async function shippingClasses({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  /* Běží v `predeploy` řetězu přes `&&` — chyba tady nesmí zastavit
     nasazení. Každá část se proto jen zaloguje a další pokračují. */
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (error: any) {
      logger.error(`[zásilky] ${name} selhalo: ${error?.message ?? error}`)
    }
  }
  let classed = 0
  let removed = 0
  let created = 0
  let switched = 0

  // 1) Třídy zásilek na výrobcích
  await step("třídy výrobků", async () => {
  const productModule: any = container.resolve(Modules.PRODUCT)
  const products: any[] = await productModule.listProducts({}, { select: ["id", "metadata"], take: 100000 })
  for (const product of products) {
    const meta = (product.metadata ?? {}) as Record<string, unknown>
    if ((SHIPPING_CLASSES as string[]).includes(String(meta.shipping_class ?? ""))) continue
    await productModule.updateProducts(product.id, {
      metadata: { ...meta, shipping_class: shippingClassOf(meta) },
    })
    classed += 1
  }
  })

  // 2–4) Volby dopravy České pošty
  await step("volby dopravy", async () => {
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const all: any[] = await fulfillment.listShippingOptions(
    {},
    { take: 500, relations: ["rules", "type"] }
  )
  const cp = all.filter((option) => String(option.provider_id ?? "").includes("ceska-posta"))

  for (const option of cp.filter((o) => o.data?.id === "cp-fragile")) {
    await fulfillment.softDeleteShippingOptions([option.id])
    removed += 1
  }

  const balikovna = cp.find((o) => o.data?.id === "balikovna")
  if (balikovna && !cp.some((o) => o.data?.id === "balikovna-address")) {
    await fulfillment.createShippingOptions({
      name: "Balíkovna na adresu",
      price_type: "calculated",
      service_zone_id: balikovna.service_zone_id,
      shipping_profile_id: balikovna.shipping_profile_id,
      provider_id: balikovna.provider_id,
      type: {
        label: balikovna.type?.label ?? "Standard",
        description: balikovna.type?.description ?? "",
        code: balikovna.type?.code ?? "standard",
      },
      data: {
        id: "balikovna-address",
        name: "Balíkovna – na adresu",
        // Kód služby u ČP podle smlouvy — viz getFulfillmentOptions v poskytovateli.
        service_code: process.env.BALIKOVNA_ADDRESS_SERVICE_CODE || "DR",
        rate_group: "balikovna",
        rates: balikovna.data?.rates ?? DEFAULT_RATES.balikovna,
      },
      rules: (balikovna.rules ?? []).map((rule: any) => ({
        attribute: rule.attribute,
        operator: rule.operator,
        value: rule.value,
      })),
    })
    created += 1
  }

  for (const option of cp.filter((o) => o.data?.id !== "cp-fragile")) {
    const group = rateGroupOf(option.data)
    const hasRates = Boolean(option.data?.rates)
    if (option.price_type === "calculated" && hasRates) continue
    const rates: ShippingRates = { ...(option.data?.rates ?? DEFAULT_RATES[group]) }
    if (isBalikovnaPickupOption(option.data)) rates.fragile = null
    await fulfillment.updateShippingOptions({
      id: option.id,
      price_type: "calculated",
      data: { ...(option.data ?? {}), rate_group: group, rates },
    })
    switched += 1
  }
  })

  logger.info(
    `[zásilky] Třída doplněna u ${classed} výrobků; volby ČP: ${switched} na vypočtenou cenu, ` +
      `${created} nová (Balíkovna na adresu), ${removed} odebraná (Česká Pošta - Křehké).`
  )
}
