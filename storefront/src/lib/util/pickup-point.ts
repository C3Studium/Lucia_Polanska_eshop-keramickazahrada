import { balikovnaPointFromMetadata } from "./balikovna"

/**
 * Vybrané výdejní místo, jak se má ukázat zákazníkovi.
 *
 * Souhrn v pokladně i potvrzení objednávky se dřív ptaly jen na
 * `packeta_pickup_point_label`. Ten ale zapisuje výhradně expresní nákup —
 * běžná pokladna ukládá u Packety samotné id a u Balíkovny čtyři vlastní
 * pole. Řádek „Výdejní místo" se proto při běžném nákupu nezobrazil vůbec
 * a zákazník před zaplacením neviděl, kam si zboží nechává poslat.
 *
 * Pořadí je od nejsdělnějšího k nejhoršímu: Balíkovna umí název i adresu,
 * expresní nákup má hotový štítek, a když nezbude nic jiného, radši holé id
 * než prázdno.
 */
export const pickupPointLabel = (
  metadata: Record<string, unknown> | null | undefined
): string => {
  const balikovna = balikovnaPointFromMetadata(metadata)

  if (balikovna) {
    return [balikovna.name, balikovna.address].filter(Boolean).join(", ")
  }

  const stitek = metadata?.packeta_pickup_point_label
  if (typeof stitek === "string" && stitek) {
    return stitek
  }

  const id = metadata?.packeta_pickup_point
  return typeof id === "string" && id ? id : ""
}
