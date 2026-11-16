import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  DEFAULT_RATES,
  isBalikovnaPickupOption,
  rateGroupOf,
  type RateGroup,
  type ShippingRates,
} from "../../../lib/shipping-rates"

/**
 * Ceny dopravy podle velikosti zásilky (16. 11. 2026, Matěj).
 *
 * Nastavení obchodu › Doprava a platba: příplatek za křehké (Česká pošta,
 * Balíkovna), malá a velká zásilka (Česká pošta, Balíkovna) a poukaz.
 * Ceny se ukládají přímo do dat voleb dopravy (`data.rates`) — tam je čte
 * výpočet ceny v poskytovateli (ceskaPostaFulfillment.calculatePrice), který
 * do nastavení obchodu nevidí. Jedna skupina = všechny její volby stejně
 * (Balíkovna výdejna i Balíkovna na adresu).
 */

const isCpOption = (option: any) => String(option?.provider_id ?? "").includes("ceska-posta")

const listCpOptions = async (req: MedusaRequest) => {
  const fulfillment: any = req.scope.resolve(Modules.FULFILLMENT)
  const options: any[] = await fulfillment.listShippingOptions({}, { take: 200 })
  return options.filter(isCpOption)
}

const ratesOfGroup = (options: any[], group: RateGroup): ShippingRates => {
  const stored = options.find((option) => rateGroupOf(option.data) === group && option.data?.rates)
  return { ...DEFAULT_RATES[group], ...((stored?.data?.rates ?? {}) as Partial<ShippingRates>) }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const options = await listCpOptions(req)
  res.status(200).json({
    rates: {
      posta: ratesOfGroup(options, "posta"),
      balikovna: ratesOfGroup(options, "balikovna"),
    },
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      group: rateGroupOf(option.data),
      price_type: option.price_type,
    })),
  })
}

const price = z.number().int().min(0).max(5000)
const groupSchema = z.object({
  small: price,
  large: price,
  fragile: price,
  poukaz: price,
})
const bodySchema = z.object({
  posta: groupSchema,
  balikovna: groupSchema,
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Ceny dopravy musí být celá čísla od 0 do 5000 Kč."
    )
  }
  const fulfillment: any = req.scope.resolve(Modules.FULFILLMENT)
  const options = await listCpOptions(req)
  for (const option of options) {
    const group = rateGroupOf(option.data)
    const rates: ShippingRates = { ...parsed.data[group] }
    // Do výdejny/BOXu křehké nesmí — příplatek tam nemá co dělat.
    if (isBalikovnaPickupOption(option.data)) rates.fragile = null
    await fulfillment.updateShippingOptions({
      id: option.id,
      data: { ...(option.data ?? {}), rate_group: group, rates },
    })
  }
  res.status(200).json({ ok: true, updated: options.length })
}
