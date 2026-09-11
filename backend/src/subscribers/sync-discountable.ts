import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  applyDiscountableRule,
  DISCOUNTABLE_PRODUCT_FIELDS,
} from "../lib/discountable"

/**
 * Drží `product.discountable` v souladu s tím, jestli je kus zlevněný.
 *
 * Pravidlo i jeho zdůvodnění bydlí v `lib/discountable.ts`. Tady je jen ta
 * část, která rozhoduje **kdy** se přepočítává.
 *
 * ## Proč i na `product.updated`
 *
 * `default-backorder.ts` schválně poslouchá jen vznik produktu — tam by
 * přepočet při každé úpravě přebil rozhodnutí paní Polanské a vypínač na
 * stránce produktu by vypadal rozbitě.
 *
 * Tady je to naopak. `discountable` není přepínač, který by kdokoli nastavoval
 * ručně; je to odvozená hodnota, důsledek příznaku Výprodej a členství
 * v sezónní akci. A oba se mění právě zápisem do produktu — takže bez
 * `product.updated` by zapnutí Výprodeje slevový kód dál pouštělo.
 *
 * ## Proč se to nezacyklí
 *
 * Přepočet zapisuje do produktu, a ten zápis vydá `product.updated` — tedy
 * událost, která nás sem přivede znovu. Podruhé už ale `rozdilyDiscountable`
 * nenajde co měnit, nezapíše se nic a řada končí. Jedno kolo navíc, ne smyčka.
 *
 * ## Proč se ceníky řeší jinde
 *
 * Sezónní akce začíná a končí datem, ne zápisem — v den, kdy ceník doběhne,
 * žádná událost nepřijde. Proto je vedle tohohle ještě denní přejezd
 * (`jobs/sync-discountable.ts`); tenhle odběratel je rychlá reakce, ten job je
 * pojistka.
 */
export default async function syncDiscountable({
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
      fields: DISCOUNTABLE_PRODUCT_FIELDS,
      filters: { id: ids },
    })

    const { zapnuto, vypnuto } = await applyDiscountableRule(
      container,
      products as any[]
    )

    if (vypnuto.length) {
      logger.info(
        `[discountable] ${vypnuto.length} zlevněných kusů už slevový kód nepřijme.`
      )
    }
    if (zapnuto.length) {
      logger.info(
        `[discountable] ${zapnuto.length} kusů se vrátilo k plné ceně, slevový kód na ně zase platí.`
      )
    }
  } catch (error) {
    /* Zápis do katalogu nesmí spadnout kvůli odvozenému příznaku. Bez něj se
       kus chová jako dosud — kód na něj projde — a denní přejezd to srovná. */
    logger.warn(
      `[discountable] Přepočet se nepodařil: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
  context: { subscriberId: "sync-discountable" },
}
