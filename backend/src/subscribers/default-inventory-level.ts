import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { doplnUrovne } from "../lib/inventory-levels"

/**
 * Nová varianta dostane na skladě svoji nulu hned, ne až při první objednávce.
 *
 * Proč to musí existovat a proč je nula bezpečná, stojí v
 * `lib/inventory-levels.ts`. Tady je jen ta část, která rozhoduje **kdy**.
 *
 * ### Proč se poslouchá vznik varianty, a ne výrobku
 *
 * Skladová položka vzniká s variantou, ne s výrobkem — a varianta se dá přidat
 * i k výrobku, který už dávno existuje. `product.created` by tedy chybějící
 * úroveň u dodatečně přidané varianty minulo.
 *
 * `product.created` je tu přesto taky: import zakládá výrobek i s variantami
 * a podle toho, jak se události poskládají, nemusí `product-variant.created`
 * přijít samostatně. Doplnění je idempotentní, takže obojí naráz nic nestojí.
 *
 * ### Proč se nedoplňuje při úpravě
 *
 * Nemá co. Úroveň buď je, nebo není; existující se tady nepřepisuje, aby se
 * ručně srovnaný stav nepřepsal nulou.
 */
export default async function applyDefaultInventoryLevel({
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
    /* Z varianty i z výrobku vede k skladové položce tatáž vazba — liší se
       jen tím, čím se filtruje. */
    const filtr =
      event.name === "product.created"
        ? { product_id: ids }
        : { id: ids }

    const { data: varianty } = await query.graph({
      entity: "product_variant",
      fields: ["id", "manage_inventory", "inventory_items.inventory_item_id"],
      filters: filtr,
    })

    const inventoryItemIds = (varianty as any[])
      /* Varianta, která zásoby nehlídá, žádnou rezervaci nezakládá a úroveň
         nepotřebuje. */
      .filter((varianta) => varianta?.manage_inventory)
      .flatMap((varianta) =>
        (varianta.inventory_items || []).map(
          (vazba: any) => vazba?.inventory_item_id
        )
      )
      .filter((id: unknown): id is string => Boolean(id))

    if (!inventoryItemIds.length) {
      return
    }

    const { zalozeno, locationId } = await doplnUrovne(
      container,
      inventoryItemIds
    )

    if (!locationId) {
      logger.warn(
        "[sklad] Úroveň zásoby se nedoplnila — obchod nemá právě jedno skladové místo."
      )
      return
    }

    if (zalozeno.length) {
      logger.info(
        `[sklad] ${zalozeno.length} novým kusům byla založena úroveň zásoby (0 ks).`
      )
    }
  } catch (error) {
    /* Zápis do katalogu nesmí spadnout kvůli doplňku. Bez úrovně se kus chová
       jako dosud — vyprodaný — a jednorázový skript to srovná. */
    logger.warn(
      `[sklad] Úroveň zásoby se nepodařilo doplnit: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product-variant.created"],
  context: { subscriberId: "default-inventory-level" },
}
