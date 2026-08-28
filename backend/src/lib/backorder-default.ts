/**
 * „Objednání bez skladu" — buying a piece that is not on the shelf.
 *
 * ## The rule
 *
 * The atelier makes everything by hand, so a sold-out piece is not a dead end:
 * it is a piece that has to be thrown, fired and glazed before it ships. The
 * shop therefore sells past zero — `allow_backorder` on the variant — and the
 * storefront turns the resulting „Na objednávku" state into a promise about the
 * wait (`storefront/src/lib/util/backorder.ts`).
 *
 * ## Why this file exists
 *
 * The flip used to be a one-time script over the existing catalog. That fixes
 * the catalog as it was on the day it ran and nothing after it: Medusa's own
 * product form, the variants drawer, an import, a duplicated product — each
 * creates variants with Medusa's default of `allow_backorder: false`, and every
 * one of those pieces silently stops selling the moment it runs out. A default
 * that has to be remembered at four different doors is not a default.
 *
 * So the rule lives here, pure and shared: the one-time script and the
 * subscriber that enforces it on every product write (`subscribers/
 * default-backorder.ts`) ask the same functions the same question.
 *
 * ## Deliberately excluded
 *
 * - **Výprodej** (`metadata.clearance`) — a damaged one-off has no second piece
 *   to make, so selling past zero would promise something that cannot exist.
 * - **Zakázková výroba** (an enabled production profile) — the commission flow
 *   owns those, with its own brief, deposit and agreed date.
 * - **Balíčky** (bundle composites) — their availability derives from the
 *   components; the bundle product itself must not answer for stock.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isClearanceProduct } from "./clearance"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

export type BackorderVariant = {
  id: string
  allow_backorder?: boolean | null
}

export type BackorderProduct = {
  id: string
  metadata?: Record<string, unknown> | null
  variants?: BackorderVariant[] | null
}

/**
 * Products the default must not touch, gathered once so a batch of products
 * costs the same two queries as a single one.
 */
export type BackorderExclusions = {
  /** Products with an enabled production profile — the zakázka flow owns them. */
  productionProductIds: ReadonlySet<string>
  /** Catalog products that stand for a bundle. */
  bundleProductIds: ReadonlySet<string>
}

export const noBackorderExclusions: BackorderExclusions = {
  productionProductIds: new Set<string>(),
  bundleProductIds: new Set<string>(),
}

/** The fields `variantIdsMissingBackorder` needs from `query.graph`. */
export const BACKORDER_PRODUCT_FIELDS = [
  "id",
  "metadata",
  "variants.id",
  "variants.allow_backorder",
]

/**
 * Whether a product sells past zero.
 *
 * Pure and exported so the three exclusions — the part that is a judgement call
 * rather than a mechanism — are provable without a database.
 */
export const isBackorderEligible = (
  product: BackorderProduct,
  exclusions: BackorderExclusions = noBackorderExclusions
): boolean => {
  if (!product?.id) {
    return false
  }
  if (isClearanceProduct(product)) {
    return false
  }
  if (exclusions.productionProductIds.has(product.id)) {
    return false
  }
  if (exclusions.bundleProductIds.has(product.id)) {
    return false
  }
  return true
}

/**
 * The variants that still need flipping.
 *
 * Returning only what actually changes is what makes the subscriber safe to run
 * on every product write: an already-correct product produces an empty list and
 * therefore no write at all.
 */
export const variantIdsMissingBackorder = (
  products: BackorderProduct[],
  exclusions: BackorderExclusions = noBackorderExclusions
): string[] => {
  const ids: string[] = []

  for (const product of products ?? []) {
    if (!isBackorderEligible(product, exclusions)) {
      continue
    }
    for (const variant of product.variants ?? []) {
      if (variant?.id && !variant.allow_backorder) {
        ids.push(variant.id)
      }
    }
  }

  return ids
}

/** Products skipped on purpose, for the log line the merchant reads. */
export const excludedProductCount = (
  products: BackorderProduct[],
  exclusions: BackorderExclusions = noBackorderExclusions
): number =>
  (products ?? []).filter((product) => !isBackorderEligible(product, exclusions))
    .length

/**
 * The two exclusion sets, read from the modules that own them.
 *
 * Bundles are tolerated as missing: the module is optional in a fresh install
 * and a failed lookup there must not stop the default from applying everywhere
 * else.
 */
export const loadBackorderExclusions = async (
  container: MedusaContainer
): Promise<BackorderExclusions> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const [profiles, bundles] = await Promise.all([
    (async () => {
      try {
        const madeToOrder = container.resolve<MadeToOrderModuleService>(
          MADE_TO_ORDER_MODULE
        )
        return (await madeToOrder.listProductProductionProfiles(
          {} as never
        )) as any[]
      } catch {
        return [] as any[]
      }
    })(),
    query
      .graph({ entity: "bundle", fields: ["id", "product.id"] })
      .then(({ data }) => data as any[])
      .catch(() => [] as any[]),
  ])

  const productionProductIds = new Set<string>(
    profiles
      .filter((profile) => profile?.enabled)
      .map((profile) => profile.product_id)
      .filter(Boolean)
  )

  const bundleProductIds = new Set<string>(
    bundles.flatMap((bundle) =>
      (Array.isArray(bundle?.product) ? bundle.product : [bundle?.product])
        .filter(Boolean)
        .map((linked: any) => linked.id)
        .filter(Boolean)
    )
  )

  return { productionProductIds, bundleProductIds }
}

/**
 * Apply the default to the given products and report what changed.
 *
 * The write goes through the product module rather than a workflow on purpose:
 * a workflow would emit `product.updated`, which is one of the events that
 * brings us here — and a subscriber that re-triggers itself is a loop waiting
 * for the one product the idempotence check ever gets wrong.
 */
export const applyBackorderDefault = async (
  container: MedusaContainer,
  products: BackorderProduct[],
  exclusions?: BackorderExclusions
): Promise<{ updatedVariantIds: string[]; skippedProducts: number }> => {
  const resolved = exclusions ?? (await loadBackorderExclusions(container))
  const updatedVariantIds = variantIdsMissingBackorder(products, resolved)
  const skippedProducts = excludedProductCount(products, resolved)

  if (updatedVariantIds.length) {
    const productModule = container.resolve(Modules.PRODUCT)

    await productModule.updateProductVariants(
      { id: updatedVariantIds } as never,
      { allow_backorder: true } as never
    )
  }

  return { updatedVariantIds, skippedProducts }
}
