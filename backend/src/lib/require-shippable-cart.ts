import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * Kus bez profilu dopravy nesmí projít až k platbě.
 *
 * ## Co se stane bez téhle pojistky
 *
 * Medusa profil dopravy u produktu nevyžaduje při zakládání, ale vyžaduje ho
 * při dokončení košíku (`validateShippingStep`): porovnává profil produktu
 * s profilem zvolené dopravy, a produkt bez profilu přispěje `undefined`, které
 * se neshodne s ničím. Košík s takovým kusem tedy **nejde dokončit vůbec** —
 * jenže to se pozná až v poslední chvíli, po návratu z platební brány. Peníze
 * odejdou, objednávka nevznikne a zbude ruční vracení platby.
 *
 * Zaznamenáno naživo: pět kusů za 363 Kč, zaplaceno, a pak
 * „The cart items require shipping profiles that are not satisfied by the
 * current shipping methods".
 *
 * ## Proč právě na výběru dopravy
 *
 * Je to poslední společné hrdlo před penězi, kterým projde každá objednávka —
 * včetně osobního odběru, který je taky doprava. Odmítnout tady stojí zákazníka
 * chvíli; odmítnout po zaplacení stojí vracení peněz a důvěru.
 *
 * ## Vlastní příčinu tím neřešíme
 *
 * Profil nemá chybět: nové produkty ho dostávají v `subscribers/default-shipping-profile.ts`
 * a stávajícím katalogem ho doplní `scripts/assign-shipping-profile.ts`. Tohle
 * je síť pod tím — pro případ, kdy se produkt do katalogu dostane cestou, na
 * kterou nikdo nemyslel.
 *
 * ## Selhává otevřeně
 *
 * Když se stav košíku nepodaří přečíst, pustí se to dál. Medusa si vlastní
 * kontrolu udělá stejně a rozbitý dotaz v pojistce nesmí být důvod, proč nejde
 * nakoupit. Jiné rozhodnutí než u `requireShipGate`, který hlídá peníze
 * odcházející a fail-closed je tam na místě.
 */

const CART_FIELDS = [
  "id",
  "items.id",
  "items.title",
  "items.requires_shipping",
  "items.variant.product.shipping_profile.id",
]

/** Položky, které se nedají odeslat, protože jejich produkt nemá profil dopravy. */
export const itemsWithoutShippingProfile = (cart: unknown): string[] =>
  (((cart as any)?.items ?? []) as any[])
    // `requires_shipping` je u běžného zboží `true`; digitální položka, která
    // dopravu nepotřebuje, profil mít nemusí a překážet nemá.
    .filter((item) => item?.requires_shipping !== false)
    .filter((item) => !item?.variant?.product?.shipping_profile?.id)
    .map((item) => String(item?.title ?? "neznámý kus"))

export const requireShippableCart = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    let nedodejitelne: string[] = []

    try {
      const cartId = req.params.id
      if (!cartId) {
        return next()
      }

      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: CART_FIELDS,
        filters: { id: cartId },
      })

      nedodejitelne = itemsWithoutShippingProfile(carts[0])
    } catch (error) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `[shipping-profile] Košík se nepodařilo zkontrolovat, pouštím dál: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      return next()
    }

    if (!nedodejitelne.length) {
      return next()
    }

    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `[shipping-profile] Košík ${req.params.id} obsahuje kusy bez profilu dopravy: ${nedodejitelne.join(
          ", "
        )}. Objednávka by po zaplacení neprošla — doprava odmítnuta. Spusťte scripts/assign-shipping-profile.ts.`
      )

    return next(
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        nedodejitelne.length === 1
          ? `Kus „${nedodejitelne[0]}" zatím neumíme odeslat — u něj chybí nastavení dopravy. Odeberte ho prosím z košíku, nebo nám napište a hned to spravíme.`
          : `Tyhle kusy zatím neumíme odeslat, chybí u nich nastavení dopravy: ${nedodejitelne.join(
              ", "
            )}. Odeberte je prosím z košíku, nebo nám napište a hned to spravíme.`
      )
    )
  }
}
