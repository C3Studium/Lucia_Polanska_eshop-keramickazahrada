/**
 * Doručení objednávky pro editaci (co a jak jde změnit).
 *
 * Sdílené mezi hostovskou (`guest-edit`) a zákaznickou (`edit`) editací, aby
 * `OrderEditContext` na frontendu měl jednotný tvar. Frontend z toho pozná,
 * jestli nabídnout „Změnit výdejní místo" (Balíkovna) nebo „Změnit adresu"
 * (pošta domů), a popup adresy předvyplní z `shipping_address`.
 *
 * `method`:
 *  - `balikovna` — doručení na výdejnu ČP (mění se výběrem výdejny ve widgetu),
 *  - `home` — pošta domů (mění se adresou v popupu),
 *  - `pickup` — osobní odběr (adresa se nemění, vyzvedává se v ateliéru),
 *  - `other` — neznámá/nenastavená doprava (editace doručení se nenabízí).
 */

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export type OrderDeliveryContext = {
  method: "balikovna" | "home" | "pickup" | "other"
  shipping_address: {
    first_name: string
    last_name: string
    address_1: string
    address_2: string
    city: string
    postal_code: string
    country_code: string
    phone: string
  } | null
  pickup_point: {
    id: string
    zip: string
    name: string
    address: string
  } | null
}

const str = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value)

export const deliveryContext = (order: any): OrderDeliveryContext => {
  const methods = (order?.shipping_methods ?? []) as any[]
  const metadata = (order?.metadata ?? {}) as Record<string, unknown>
  const sa = order?.shipping_address as Record<string, unknown> | null | undefined

  const isBalikovna = methods.some((m) => fold(str(m?.name)).includes("balikovna"))
  const isPickup = methods.some((m) => {
    const provider = str(m?.shipping_option?.provider_id)
    return (
      (m?.data as any)?.personal_pickup === true ||
      fold(str(m?.name)).includes("osobni") ||
      fold(str(m?.name)).includes("odber") ||
      provider.includes("pickup")
    )
  })

  const method: OrderDeliveryContext["method"] = isBalikovna
    ? "balikovna"
    : isPickup
      ? "pickup"
      : methods.length
        ? "home"
        : "other"

  const shipping_address = sa
    ? {
        first_name: str(sa.first_name),
        last_name: str(sa.last_name),
        address_1: str(sa.address_1),
        address_2: str(sa.address_2),
        city: str(sa.city),
        postal_code: str(sa.postal_code),
        country_code: str(sa.country_code) || "cz",
        phone: str(sa.phone),
      }
    : null

  const pointName = str(metadata.balikovna_point_name)
  const pickup_point =
    isBalikovna && pointName
      ? {
          id: str(metadata.balikovna_point_id),
          zip: str(metadata.balikovna_point_zip),
          name: pointName,
          address: str(metadata.balikovna_point_address),
        }
      : null

  return { method, shipping_address, pickup_point }
}
