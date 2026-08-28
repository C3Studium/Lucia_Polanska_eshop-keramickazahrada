import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  applyBackorderDefault,
  BACKORDER_PRODUCT_FIELDS,
} from "../lib/backorder-default"

/**
 * „Objednání bez skladu" as an actual default, not a thing to remember.
 *
 * A sold-out piece has to keep selling — the atelier makes it after the order
 * (see `lib/backorder-default.ts` for the rule and its three exclusions). The
 * flip is a per-variant flag, and Medusa creates variants with it *off*, so
 * before this subscriber every door into the catalog reopened the hole:
 * Medusa's own product form, an import, a duplicated product, a variant added
 * from the native page. Each produced pieces that stop selling at zero, and
 * nothing said so until a customer hit „Prodáno" on a piece the shop would have
 * been glad to make.
 *
 * Enforcing it on the creation event, rather than at each door, means the rule
 * holds no matter who writes the product.
 *
 * ### Creation only — on purpose
 *
 * This deliberately does not listen to `product.updated`. A default may decide
 * what a piece starts as; it may not overrule the merchant afterwards. The
 * product page has a „Objednání bez skladu" switch, and if this ran on updates
 * it would flip that switch back on within the second — the toggle would look
 * broken and the one product she meant to stop selling would keep selling.
 * A variant that exists has been decided about; only a new one has not.
 *
 * The one-time script (`scripts/enable-backorder-default.ts`) stays as the way
 * to re-assert the default over an existing catalog by hand — an explicit act,
 * which is exactly what overriding a past decision should be.
 */
export default async function applyBackorderDefaultOnCreate({
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
    // `product-variant.created` carries variant ids; `product.created` carries
    // product ids. Covering both is what catches a variant added on its own to
    // a product that already exists.
    const productIds =
      event.name === "product-variant.created"
        ? await productIdsForVariants(query, ids)
        : ids

    if (!productIds.length) {
      return
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: BACKORDER_PRODUCT_FIELDS,
      filters: { id: productIds },
    })

    const { updatedVariantIds } = await applyBackorderDefault(
      container,
      products as any[]
    )

    if (updatedVariantIds.length) {
      logger.info(
        `[backorder-default] ${updatedVariantIds.length} nových variant nastaveno na objednání bez skladu.`
      )
    }
  } catch (error) {
    // A catalog write must not fail because of a default. Without it the piece
    // is still sellable while stocked — Medusa's own behaviour — and the script
    // can re-assert the default later.
    logger.warn(
      `[backorder-default] Výchozí nastavení se nepodařilo použít: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

const productIdsForVariants = async (
  query: { graph: (config: any) => Promise<{ data: any[] }> },
  variantIds: string[]
): Promise<string[]> => {
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  })

  return Array.from(
    new Set(
      (variants as any[])
        .map((variant) => variant?.product_id)
        .filter((id): id is string => Boolean(id))
    )
  )
}

export const config: SubscriberConfig = {
  event: ["product.created", "product-variant.created"],
  context: { subscriberId: "default-backorder" },
}
