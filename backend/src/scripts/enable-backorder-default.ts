import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

/**
 * One-time default flip: „objednání bez skladu" for the existing catalog
 * (Matěj, 2026-08-16).
 *
 * New variants are created with `allow_backorder: true` (novy-produkt, the
 * product page, the variants drawer); this script brings the pieces that
 * already exist to the same default, so a sold-out piece keeps selling and
 * stock goes negative instead of stopping the shop.
 *
 * Deliberately skipped:
 * - clearance pieces (`metadata.clearance`) — a damaged one-off has no second
 *   piece to make, and the retire job hides it at sell-out anyway;
 * - products with an enabled production profile — the zakázka flow owns them;
 * - bundle composites — their availability derives from the components.
 *
 * Run with:  npx medusa exec ./src/scripts/enable-backorder-default.ts
 * Idempotent — variants already allowing backorder are left alone.
 */
export default async function enableBackorderDefault({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const [{ data: products }, profiles, { data: bundles }] = await Promise.all([
    query.graph({
      entity: "product",
      fields: ["id", "title", "metadata", "variants.id", "variants.allow_backorder"],
      pagination: { take: 1000, skip: 0 },
    }),
    madeToOrder.listProductProductionProfiles({} as never) as Promise<any[]>,
    query
      .graph({ entity: "bundle", fields: ["id", "product.id"] })
      .catch(() => ({ data: [] as any[] })),
  ])

  const productionProductIds = new Set(
    (profiles as any[])
      .filter((profile) => profile.enabled)
      .map((profile) => profile.product_id)
  )
  const bundleProductIds = new Set(
    (bundles as any[]).flatMap((bundle) =>
      (Array.isArray(bundle.product) ? bundle.product : [bundle.product])
        .filter(Boolean)
        .map((linked: any) => linked.id)
    )
  )

  const variantIds: string[] = []
  let skipped = 0
  for (const product of products as any[]) {
    const isClearance = Boolean(product.metadata?.clearance)
    const isProduction = productionProductIds.has(product.id)
    const isBundle = bundleProductIds.has(product.id)
    if (isClearance || isProduction || isBundle) {
      skipped += 1
      continue
    }
    for (const variant of product.variants ?? []) {
      if (!variant.allow_backorder) {
        variantIds.push(variant.id)
      }
    }
  }

  if (!variantIds.length) {
    logger.info(
      `[backorder-default] Nic ke změně — všechny běžné varianty už objednání bez skladu povolují (${skipped} produktů vynecháno záměrně).`
    )
    return
  }

  await productModule.updateProductVariants(
    { id: variantIds } as never,
    { allow_backorder: true } as never
  )

  logger.info(
    `[backorder-default] Hotovo: ${variantIds.length} variant nově povoluje objednání bez skladu; ${skipped} produktů vynecháno (výprodej / zakázka / balíček).`
  )
}
