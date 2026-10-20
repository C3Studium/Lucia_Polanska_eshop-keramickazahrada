import { isPickupFulfillment } from "@lib/constants"
import { isMadeToOrderLine } from "@lib/util/commission"
import { deliveryAllowedUnder, deliveryRestrictionFor } from "@lib/util/fragile"

/**
 * „Doprava od …" v košíku, dokud zákazník dopravu nevybral.
 *
 * Dřív tam stálo „Doprava 0 Kč" (a u slovenského košíku „0 €") — jako by
 * doprava byla zdarma. Cenu dopravy má zákazník vidět předem (§ 1820 OZ),
 * u SK/EUR objednávek už v košíku, a v měně košíku.
 *
 * Bere se nejlevnější PŘEPRAVCE, kterého košík opravdu smí použít (křehké
 * kusy a zakázky jen křehký balík nebo odběr — `fragile.ts`). Osobní odběr se
 * do „od" nepočítá: „od 0 Kč" by tvrdilo, že poslat se dá zadarmo; řekne se
 * zvlášť. Možnosti s dopočítávanou cenou (`price_type: "calculated"`) cenu
 * v seznamu nemají — když zbude jen taková, vrátí se `amount: null` a košík
 * odkáže na ceník.
 */
export type ShippingFrom = {
  /** Nejlevnější přepravce v měně košíku; `null` = nevíme → odkaz na ceník. */
  amount: number | null
  /** Osobní odběr je k mání a nic nestojí. */
  pickupFree: boolean
}

type OptionLike = {
  name?: string | null
  amount?: number | null
  price_type?: string | null
  provider_id?: string | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

const isPickupOption = (option: OptionLike) =>
  isPickupFulfillment(option.provider_id ?? undefined) ||
  option.service_zone?.fulfillment_set?.type === "pickup"

export const shippingFromOptions = (
  options: OptionLike[] | null | undefined,
  cart: { items?: any[] | null } | null
): ShippingFrom | null => {
  if (!options?.length) return null

  const restriction = deliveryRestrictionFor(
    cart as any,
    ((cart?.items ?? []) as any[]).some(isMadeToOrderLine)
  )

  const usable = options.filter(
    (option) => !restriction || deliveryAllowedUnder(option, isPickupOption(option))
  )

  const priced = (option: OptionLike) =>
    option.price_type !== "calculated" && typeof option.amount === "number"

  const carrierPrices = usable
    .filter((option) => !isPickupOption(option) && priced(option))
    .map((option) => Number(option.amount))
  const pickupFree = usable.some(
    (option) => isPickupOption(option) && priced(option) && Number(option.amount) === 0
  )

  return {
    amount: carrierPrices.length ? Math.min(...carrierPrices) : null,
    pickupFree,
  }
}
