/**
 * `shipping_address`, jak má vypadat u Balíkovny: VÝDEJNA jako doručovací
 * adresa, kontakt příjemce (jméno + telefon) zachovaný.
 *
 * Jedno místo pravdy pro OBA vstupy do téhle adresy:
 *  - subscriber `pickup-shipping-address` při vzniku objednávky,
 *  - endpoint `orders/:id/delivery` při pozdější změně výdejny v úpravě.
 *
 * `company` ZÁMĚRNĚ prázdná — ČP štítek by jinak vzal firmu místo jména
 * (viz `ceskaPostaFulfillment/parcel.ts`). Výdejnu samotnou bere štítek z
 * metadat (`balikovna_point_zip`), ne z téhle adresy, takže se tím neláme.
 */

export type BalikovnaPointLike = {
  zip: string
  name: string
  address?: string | null
}

export type RecipientContact = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  country_code?: string | null
}

export const balikovnaShippingAddress = (
  point: BalikovnaPointLike,
  contact: RecipientContact
): Record<string, string> => ({
  first_name: contact.first_name ?? "",
  last_name: contact.last_name ?? "",
  phone: contact.phone ?? "",
  company: "",
  address_1: "Balíkovna",
  address_2: [point.name, point.address ?? ""].filter(Boolean).join(", "),
  city: point.name,
  postal_code: point.zip,
  country_code: contact.country_code || "cz",
})
