import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import {
  assignShippingProfile,
  resolveDefaultShippingProfile,
} from "./shipping-profile-default"

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
 * ## Radši spraví, než odmítne
 *
 * Odmítnout zákazníka kvůli chybějícímu údaji v našich datech je špatná
 * výměna: on o nákup přijde, my o prodej, a náprava je jedno přiřazení, které
 * se dá udělat na místě. Pojistka proto kusu bez profilu přidělí ten výchozí
 * a pustí objednávku dál. Je to přesně ta operace, která měla proběhnout při
 * zakládání produktu, jen o pár dní později.
 *
 * Přiřazuje se **výchozí profil**, ne nějaký náhradní: na něm leží všechny
 * dopravy naráz, takže kus tím dostane poštu, Balíkovnu i osobní odběr —
 * a nikomu se netvrdí nic, co není pravda.
 *
 * Odmítne se, až když ani to nejde (obchod nemá jednoznačný výchozí profil,
 * nebo zápis selže). Pak je to skutečně na člověka.
 *
 * Do logu jde pokaždé hlasitá zpráva. Tohle je záplata, ne řešení — profil
 * nemá chybět: nové produkty ho dostávají v `subscribers/default-shipping-profile.ts`
 * a stávajícímu katalogu ho doplní `scripts/assign-shipping-profile.ts`.
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
  "items.variant.product.id",
  "items.variant.product.shipping_profile.id",
]

export type NedodejitelnaPolozka = {
  /** Prázdné, když se z položky nedá vyčíst produkt — pak nejde ani spravit. */
  productId: string
  title: string
}

/** Položky, které se nedají odeslat, protože jejich produkt nemá profil dopravy. */
export const itemsWithoutShippingProfile = (
  cart: unknown
): NedodejitelnaPolozka[] =>
  (((cart as any)?.items ?? []) as any[])
    // `requires_shipping` je u běžného zboží `true`; digitální položka, která
    // dopravu nepotřebuje, profil mít nemusí a překážet nemá.
    .filter((item) => item?.requires_shipping !== false)
    .filter((item) => !item?.variant?.product?.shipping_profile?.id)
    .map((item) => ({
      productId: String(item?.variant?.product?.id ?? ""),
      title: String(item?.title ?? "neznámý kus"),
    }))

export const requireShippableCart = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    let nedodejitelne: NedodejitelnaPolozka[] = []

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

    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    const nazvy = nedodejitelne.map((item) => item.title).join(", ")
    const bezProfilu = nedodejitelne.filter((item) => item.productId)

    // Pokus o nápravu na místě, ať zákazník nedoplácí na chybějící údaj.
    try {
      const profil = await resolveDefaultShippingProfile(req.scope as any)

      if (profil && bezProfilu.length) {
        await assignShippingProfile(
          req.scope as any,
          bezProfilu.map((item) => item.productId),
          profil.id
        )


        logger.warn(
          `[shipping-profile] Kusům bez profilu jsem cestou přidělil ${profil.name}: ${nazvy}. Objednávka pokračuje, ale katalog je potřeba srovnat — scripts/assign-shipping-profile.ts.`
        )

        return next()
      }
    } catch (error) {
      logger.error(
        `[shipping-profile] Profil se nepodařilo přidělit za běhu: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    logger.error(
      `[shipping-profile] Košík ${req.params.id} obsahuje kusy bez profilu dopravy: ${nazvy}. Přidělit profil se nepovedlo, doprava odmítnuta. Spusťte scripts/assign-shipping-profile.ts.`
    )

    return next(
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        nedodejitelne.length === 1
          ? `Kus „${nazvy}" zatím neumíme odeslat — u něj chybí nastavení dopravy. Odeberte ho prosím z košíku, nebo nám napište a hned to spravíme.`
          : `Tyhle kusy zatím neumíme odeslat, chybí u nich nastavení dopravy: ${nazvy}. Odeberte je prosím z košíku, nebo nám napište a hned to spravíme.`
      )
    )
  }
}
