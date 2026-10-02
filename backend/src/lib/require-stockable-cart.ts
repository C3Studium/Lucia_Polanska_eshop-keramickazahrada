import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { doplnUrovne } from "./inventory-levels"

/**
 * Kus, který jde objednat i bez skladu, musí mít kam zapsat rezervaci.
 *
 * ## Co se stane bez téhle pojistky
 *
 * Klientka si přála prodej i mimo sklad (`allow_backorder`), jenže ten sám
 * nestačí: Medusa při dokončení košíku zakládá rezervaci a tu nemá kam zapsat,
 * když pro skladovou položku na dané lokaci neexistuje **úroveň zásoby**
 * (`inventory_level`). Dokončení pak padá na
 *
 *     Item iitem_… is not stocked at location sloc_…
 *
 * a vrací 404 — a to AŽ po návratu z platební brány. Zaznamenáno naživo (2. 10.
 * 2026): zaplacená platba ComGate (PAID), košík se ale dokončit nepodařilo
 * osmkrát po sobě, objednávka nevznikla a po každém pokusu zbyla osiřelá vazba.
 * Na živé DB byla v tu chvíli bez úrovně skoro polovina katalogu (121 z 264
 * položek) — každý takový košík by skončil stejně.
 *
 * `allow_backorder` umí jít pod nulu, ale **jen tam, kde nějaká nula je.**
 * Prodej bez skladu tedy není jen přepínač na variantě; je to i tahle úroveň.
 *
 * ## Proč na dokončení košíku
 *
 * Je to poslední hrdlo před tím, než Medusa rezervaci založí, a projde jím
 * každá pokladna — běžná, expresní i ručně psaný klient. Doplnit nulu tady je
 * poslední šance spravit to dřív, než zákazník zaplatí a objednávka přesto
 * nevznikne. Pokrývá i kus vyrobený před vteřinou, který subscriber ani
 * startovní sweep ještě nestihly.
 *
 * ## Proč je nula bezpečná
 *
 * Bez úrovně hlásí Medusa dostupnost 0; založením úrovně s nulou se na
 * dostupnosti nemění nic — jen vznikne místo, kam se dá rezervace zapsat a
 * odkud smí stav klesnout do minusu, jak to prodej bez skladu má dělat. Celé
 * zdůvodnění je v `lib/inventory-levels.ts`.
 *
 * ## Radši spraví, než odmítne — a selhává otevřeně
 *
 * Doplnění je idempotentní a tichý doplněk: kus, který úroveň má, nevyvolá
 * žádný zápis. Když se cokoliv nepovede (rozbitý dotaz, krátký výpadek
 * modulu), pustí se košík dál — Medusa si rezervaci stejně zkusí sama a
 * selhání pojistky nesmí být důvod, proč nejde nakoupit. Jiné rozhodnutí než
 * u `requireShipGate`, který hlídá odcházející peníze a je fail-closed.
 *
 * Tohle je pojistka, ne řešení: nové varianty drží `subscribers/
 * default-inventory-level.ts` a celý sklad srovná `loaders/
 * backfill-inventory-levels.ts` při startu. Sem se spadne jen to, co obojí
 * minulo.
 */

const CART_FIELDS = [
  "id",
  "items.id",
  "items.variant.manage_inventory",
  "items.variant.inventory_items.inventory_item_id",
]

/** Skladové položky variant z košíku, které hlídají stav (a potřebují úroveň). */
export const managedInventoryItemIds = (cart: unknown): string[] => {
  const items = ((cart as any)?.items ?? []) as any[]
  const ids = items
    .map((item) => item?.variant)
    .filter((variant) => variant?.manage_inventory)
    .flatMap((variant) =>
      (variant.inventory_items ?? []).map(
        (link: any) => link?.inventory_item_id
      )
    )
    .filter((id: unknown): id is string => Boolean(id))

  return Array.from(new Set(ids))
}

export const requireStockableCart = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

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

      const inventoryItemIds = managedInventoryItemIds(carts[0])
      if (!inventoryItemIds.length) {
        return next()
      }

      const { zalozeno } = await doplnUrovne(req.scope, inventoryItemIds)

      if (zalozeno.length) {
        logger.warn(
          `[sklad] Košík ${cartId}: ${zalozeno.length} kusům chyběla úroveň zásoby, doplnil jsem nulu, aby šel dokončit. Katalog je potřeba srovnat — loaders/backfill-inventory-levels.ts běží při startu.`
        )
      }
    } catch (error) {
      // Fail-open: Medusa si rezervaci zkusí sama; rozbitá pojistka nesmí
      // zablokovat nákup.
      logger.warn(
        `[sklad] Doplnění úrovní před dokončením košíku selhalo, pouštím dál: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }

    return next()
  }
}
