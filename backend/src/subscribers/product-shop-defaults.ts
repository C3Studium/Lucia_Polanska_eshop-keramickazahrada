import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  asciiHandle,
  needsAsciiHandle,
  needsShopChannel,
  uniqueHandle,
} from "../lib/product-shop-defaults"

/**
 * Nový / publikovaný výrobek → v kanálu obchodu a s ASCII adresou
 * (18. 11. 2026, viz lib/product-shop-defaults.ts — „Stránka nenalezena"
 * u nově založeného výrobku).
 *
 * Nikdy nevyhodí: zápis výrobku už proběhl, tohle je doplnění.
 */
export default async function productShopDefaults({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const ids = (Array.isArray(event.data) ? event.data : [event.data])
    .map((entry) => entry?.id)
    .filter((id): id is string => Boolean(id))
  if (!ids.length) return

  try {
    const { data: products } = (await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "status", "sales_channels.id"],
      filters: { id: ids },
    })) as { data: any[] }

    // 1) Prodejní kanál obchodu.
    const bezKanalu = products.filter((product) => needsShopChannel(product, event.name))
    if (bezKanalu.length) {
      const [store] = (await container
        .resolve(Modules.STORE)
        .listStores({}, { select: ["id", "default_sales_channel_id"] as never })) as any[]
      const kanal = store?.default_sales_channel_id as string | undefined
      if (!kanal) {
        logger.warn(
          `[obchod] ${bezKanalu.length} výrobků je bez prodejního kanálu a obchod nemá výchozí — v obchodě nebudou vidět.`
        )
      } else {
        await container.resolve(ContainerRegistrationKeys.LINK).create(
          bezKanalu.map((product) => ({
            [Modules.PRODUCT]: { product_id: product.id },
            [Modules.SALES_CHANNEL]: { sales_channel_id: kanal },
          }))
        )
        logger.info(
          `[obchod] Do kanálu obchodu přidáno: ${bezKanalu.map((p) => p.title).join(", ")}.`
        )
      }
    }

    // 2) ASCII adresa — jen u nově založených (u starých by se změnil odkaz).
    if (event.name === "product.created") {
      const kOprave = products.filter((product) => needsAsciiHandle(product.handle))
      if (kOprave.length) {
        const productModule = container.resolve(Modules.PRODUCT) as any
        for (const product of kOprave) {
          const zaklad = asciiHandle(product.title || product.handle) || asciiHandle(product.handle)
          if (!zaklad) continue
          const existujici = (await productModule.listProducts(
            { handle: [zaklad, ...Array.from({ length: 20 }, (_, i) => `${zaklad}-${i + 2}`)] },
            { select: ["handle"] }
          )) as { handle: string }[]
          const handle = uniqueHandle(zaklad, new Set(existujici.map((p) => p.handle)))
          await productModule.updateProducts(product.id, { handle })
          logger.info(`[obchod] Adresa výrobku „${product.title}" → ${handle}.`)
        }
      }
    }
  } catch (error) {
    logger.error(
      `[obchod] Doplnění kanálu/adresy výrobku se nepodařilo: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
  context: { subscriberId: "product-shop-defaults" },
}
