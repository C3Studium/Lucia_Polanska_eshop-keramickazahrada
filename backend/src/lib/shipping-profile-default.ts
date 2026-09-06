import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Každý produkt musí mít profil dopravy — jinak se objednávka nedokončí.
 *
 * Medusa při dokončení košíku porovnává profil dopravy produktu s profilem
 * zvolené dopravy (`validateShippingStep` v core-flows):
 *
 *     const požadované = položky.map((i) => i.variant.product?.shipping_profile?.id)
 *     const dostupné   = metody.map((m) => profilNabídky.get(m.shipping_option_id))
 *     const chybějící  = požadované.filter((p) => !dostupné.includes(p))
 *
 * Produkt bez profilu tam přispěje `undefined`, a to se se skutečným profilem
 * dopravy neshodne nikdy. Košík takový kus obsahující tedy nejde dokončit
 * ničím, co zákazník udělá — vybere dopravu, zaplatí, vrátí se z brány a
 * dostane „The cart items require shipping profiles that are not satisfied by
 * the current shipping methods". Peníze odejdou, objednávka nevznikne.
 *
 * Produkty přenesené z původního WordPressu profil nedostaly: `shipping_profile_id`
 * se do produktu propisuje jen tehdy, když ho zakládající volání pošle, a import
 * ho neposílal.
 *
 * Odkaz produkt ↔ profil je remote link mezi moduly PRODUCT a FULFILLMENT —
 * stejný, jaký zakládá `createProductsWorkflow`, jen dodatečně.
 */

/** Co `productsMissingShippingProfile` potřebuje z `query.graph`. */
export const SHIPPING_PROFILE_PRODUCT_FIELDS = [
  "id",
  "title",
  "shipping_profile.id",
]

/**
 * Výchozí profil dopravy obchodu.
 *
 * Bere se ten s typem `default`; když ho obchod nemá, ale profil je jediný,
 * je to on. Při víc profilech bez výchozího se raději nehádá — přiřadit kus
 * ke špatnému profilu znamená nabídnout u něj špatnou dopravu.
 */
export const resolveDefaultShippingProfile = async (
  container: MedusaContainer
): Promise<{ id: string; name: string } | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })

  const vychozi = (profiles as any[]).find(
    (profile) => profile?.type === "default"
  )

  if (vychozi) {
    return { id: vychozi.id, name: vychozi.name }
  }

  return profiles.length === 1
    ? { id: (profiles[0] as any).id, name: (profiles[0] as any).name }
    : null
}

/** Produkty, kterým odkaz na profil chybí. Vrací id a názvy pro výpis. */
export const productsMissingShippingProfile = (products: any[]) =>
  products
    .filter((product) => !product?.shipping_profile?.id)
    .map((product) => ({ id: product.id as string, title: product.title as string }))

/**
 * Doplní odkaz na profil. Zapisuje po dávkách, protože katalog má stovky kusů
 * a jedna transakce přes všechny je zbytečné riziko.
 */
export const assignShippingProfile = async (
  container: MedusaContainer,
  productIds: string[],
  shippingProfileId: string,
  davka = 50
) => {
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  for (let i = 0; i < productIds.length; i += davka) {
    await link.create(
      productIds.slice(i, i + davka).map((product_id) => ({
        [Modules.PRODUCT]: { product_id },
        [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfileId },
      }))
    )
  }
}
