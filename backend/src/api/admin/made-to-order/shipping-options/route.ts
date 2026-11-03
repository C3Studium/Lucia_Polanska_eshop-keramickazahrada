import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isPickupOption } from "../../../../lib/made-to-order/shipping-choice"

/**
 * Možnosti dopravy pro zakázku s cenou po domluvě.
 *
 * Kus se objednává na osobní odběr (v pokladně není z čeho spočítat
 * poštovné). Když si to zákazník rozmyslí, vybere se doprava tady — a protože
 * se tím mění doprava celé objednávky, musí ten výběr nabízet skutečné
 * možnosti i s jejich `data` (služba ČP, „Křehce"), ne jen částku.
 *
 * Vrácení zásilky se nenabízí: to není doprava zákazníkovi, ale od něj.
 */

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Number(source.value ?? source.numeric_ ?? 0) || 0
  }
  return 0
}

/**
 * Napovídaná cena: ceník bez podmínek v měně objednávky. Ceny s pravidly
 * (zdarma nad N Kč) se nenapovídají — u zakázky se poštovné stejně domlouvá.
 */
const flatPriceOf = (option: any, currencyCode: string): number | null => {
  const prices = (option?.prices ?? []) as any[]
  const match = prices.find(
    (price) =>
      String(price?.currency_code ?? "").toLowerCase() === currencyCode &&
      !(price?.price_rules ?? []).length
  )
  return match ? toNumber(match.amount) : null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const currencyCode = String(req.query.currency_code ?? "czk").toLowerCase()

  const { data } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "data",
      "prices.amount",
      "prices.currency_code",
      "prices.price_rules.attribute",
    ],
  })

  const options = (data as any[])
    .filter((option) => option?.data?.is_return !== true)
    .map((option) => ({
      id: String(option.id),
      name: String(option.name ?? "Doprava"),
      personal_pickup: isPickupOption(option),
      price: flatPriceOf(option, currencyCode),
    }))
    // Osobní odběr napřed — tak si zákazník objednal.
    .sort((a, b) =>
      a.personal_pickup === b.personal_pickup
        ? a.name.localeCompare(b.name, "cs")
        : a.personal_pickup
          ? -1
          : 1
    )

  res.status(200).json({ shipping_options: options })
}
