import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  assignShippingProfile,
  productsMissingShippingProfile,
  resolveDefaultShippingProfile,
  SHIPPING_PROFILE_PRODUCT_FIELDS,
} from "../lib/shipping-profile-default"

/**
 * Profil dopravy jako skutečná výchozí hodnota, ne věc k zapamatování.
 *
 * Produkt bez profilu se dá vystavit, vložit do košíku i zaplatit — a teprve
 * pak se objednávka odmítne, protože Medusa profil vyžaduje při dokončení
 * košíku. Zákazník v tu chvíli už zaplatil. Podrobnosti a přesné porovnání,
 * které to shodí, jsou v `lib/shipping-profile-default.ts`.
 *
 * Medusa profil sama nedoplňuje: propíše ho jen tehdy, když ho zakládající
 * volání pošle. Import z WordPressu ho neposílal, a stejnou díru otevře každá
 * další cesta do katalogu, která na něj zapomene.
 *
 * ### Jen při vzniku — schválně
 *
 * Na `product.updated` se schválně neposlouchá. Výchozí hodnota smí rozhodnout,
 * s čím kus začíná; nesmí přebíjet, co si obchod rozhodl potom. Kdyby někdo
 * kus vědomě přeřadil na jiný profil (křehké zboží, nadrozměr), tenhle
 * subscriber by mu to do vteřiny vrátil zpátky.
 *
 * Jednorázový skript (`scripts/assign-shipping-profile.ts`) zůstává jako
 * způsob, jak profil doplnit stávajícímu katalogu — vědomý krok, což je přesně
 * to, čím přepsání dřívějšího rozhodnutí má být.
 */
export default async function applyDefaultShippingProfile({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const ids = (Array.isArray(event.data) ? event.data : [event.data])
    .map((entry) => entry?.id)
    .filter((id): id is string => Boolean(id))

  if (!ids.length) {
    return
  }

  try {
    const { data: products } = await query.graph({
      entity: "product",
      fields: SHIPPING_PROFILE_PRODUCT_FIELDS,
      filters: { id: ids },
    })

    const chybejici = productsMissingShippingProfile(products as any[])

    if (!chybejici.length) {
      return
    }

    const profil = await resolveDefaultShippingProfile(container)

    if (!profil) {
      logger.warn(
        `[shipping-profile] ${chybejici.length} nových produktů je bez profilu dopravy a výchozí profil nejde určit — objednávka s nimi se nedokončí. Přiřaďte profil ručně.`
      )
      return
    }

    await assignShippingProfile(
      container,
      chybejici.map((product) => product.id),
      profil.id
    )

    logger.info(
      `[shipping-profile] ${chybejici.length} nových produktů dostalo profil ${profil.name}.`
    )
  } catch (error) {
    // Doplnění profilu nesmí shodit zápis produktu — bez něj se neprodá, ale
    // spadlý import je horší. Nedodělek posbírá jednorázový skript.
    logger.error(
      `[shipping-profile] Profil dopravy se nepodařilo doplnit: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
  context: { subscriberId: "default-shipping-profile" },
}
