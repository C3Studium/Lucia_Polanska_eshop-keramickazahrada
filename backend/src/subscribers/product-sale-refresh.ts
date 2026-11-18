import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { refreshProductSale, removeProductSale } from "../lib/product-sale"
import revalidateStorefront from "./revalidate-storefront"

/**
 * Sleva u výrobku drží absolutní částky (`lib/product-sale.ts`). Když se
 * změní cena provedení — ručně v adminu nebo ranním přepočtem z kurzu ČNB —
 * nebo přibude provedení, akční cena se spočítá znovu se stejnými procenty
 * a obdobím. Smazaný výrobek si slevu neodnese do seznamu ve Slevách.
 */
export default async function productSaleRefresh({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const id = event.data?.id
  if (!id) return

  try {
    if (event.name === "product.deleted") {
      const removed = await removeProductSale(container, id)
      if (removed) logger.info(`[sleva] Smazaný výrobek ${id} — sleva odebrána.`)
      return
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product_id"],
      filters: { id },
    })
    const productId = (data as any[])[0]?.product_id
    if (!productId) return

    const sale = await refreshProductSale(container, productId)
    if (!sale) return

    logger.info(`[sleva] Cena výrobku ${productId} se změnila — akční cena přepočtena (−${sale.percent} %).`)
    await revalidateStorefront({
      container,
      event: { name: "product-sale.refreshed", data: { id: productId } },
    } as never)
  } catch (error) {
    logger.warn(
      `[sleva] Přepočet slevy po změně ${id} se nepodařil: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product-variant.updated", "product-variant.created", "product.deleted"],
  context: { subscriberId: "product-sale-refresh" },
}
