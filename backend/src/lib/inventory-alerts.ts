/**
 * Low-stock and sold-out detection (WorkflowPlan.md §10).
 *
 * Native inventory is the truth; nothing here is stored. The rules the merchant
 * actually cares about are the ones Medusa has no opinion about:
 *
 * - **Available**, not stocked. Reserved pieces belong to paid orders waiting to
 *   be packed — counting them as sellable is how a shop oversells.
 * - **A threshold per item.** `inventory_item.metadata.low_stock_threshold`
 *   overrides the shop-wide default, so a piece she can throw in an afternoon
 *   and one that needs two firings do not warn at the same number. Using
 *   metadata means no migration.
 * - **Made-to-order is not stock.** A commissioned piece is made after it is
 *   ordered, so "0 available" is its normal state and must never be a warning.
 *
 * Shared deliberately: this is used by the Přehled tiles (P2-3), the two Sklad
 * pages and their endpoint (P7-1) and the daily stock job (P7-2). One rule set,
 * one place — three copies of "what counts as low" would drift within a week.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantSettings } from "./merchant-settings"

export type InventoryAlertRow = {
  variant_id: string
  variant_title: string | null
  product_id: string | null
  product_title: string | null
  sku: string | null
  inventory_item_id: string | null
  stocked: number
  reserved: number
  available: number
  /** The threshold that applied to this row — global unless overridden. */
  threshold: number
  /** True when the threshold came from the item rather than the shop default. */
  has_custom_threshold: boolean
  /**
   * Where the stock sits. Needed to *change* it: the native level update is
   * keyed by item **and** location, so a row that cannot name its location is a
   * row she can only look at.
   */
  location_id: string | null
}

export type InventoryAlerts = {
  low: InventoryAlertRow[]
  out: InventoryAlertRow[]
  /** Healthy stock. Not an alert, but „what do I actually have?" is a question
   * she asks just as often as „what is running out?". */
  ok: InventoryAlertRow[]
  default_threshold: number
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // bigNumber values arrive as `{ value, precision }` from some projections.
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

/**
 * `available_quantity` exists on the level as a *computed* model field, and
 * computed fields are exactly the kind of projection that comes back silently
 * empty. Stocked minus reserved is the same arithmetic Medusa does, from two
 * plain columns.
 */
const availabilityOf = (levels: any[]): { stocked: number; reserved: number } =>
  (levels || []).reduce(
    (totals, level) => ({
      stocked: totals.stocked + toNumber(level?.stocked_quantity),
      reserved: totals.reserved + toNumber(level?.reserved_quantity),
    }),
    { stocked: 0, reserved: 0 }
  )

export const thresholdFor = (
  inventoryItem: any,
  defaultThreshold: number
): { threshold: number; custom: boolean } => {
  const raw = inventoryItem?.metadata?.low_stock_threshold
  const parsed = Number(raw)

  if (raw !== undefined && raw !== null && Number.isFinite(parsed) && parsed >= 0) {
    return { threshold: Math.floor(parsed), custom: true }
  }
  return { threshold: defaultThreshold, custom: false }
}

/**
 * Decides what a single variant is: low, out, or not our problem.
 *
 * Pure and exported so the rules that matter — the threshold merge and the two
 * exclusions — are provable without a database. `getInventoryAlerts` below is
 * then only the query around it.
 */
export const classifyVariant = (
  variant: any,
  defaultThreshold: number,
  excludedVariantIds: Set<string>
): { bucket: "low" | "out" | "ok"; row: InventoryAlertRow } | null => {
  // A variant that does not track stock cannot run out of it.
  if (!variant?.manage_inventory) {
    return null
  }
  if (excludedVariantIds.has(variant.id)) {
    return null
  }

  const inventoryItem = (variant.inventory || [])[0]
  if (!inventoryItem) {
    return null
  }

  const { stocked, reserved } = availabilityOf(inventoryItem.location_levels)
  const available = stocked - reserved
  const { threshold, custom } = thresholdFor(inventoryItem, defaultThreshold)

  const row: InventoryAlertRow = {
    variant_id: variant.id,
    variant_title: variant.title ?? null,
    product_id: variant.product?.id ?? null,
    product_title: variant.product?.title ?? null,
    sku: variant.sku ?? null,
    inventory_item_id: inventoryItem.id ?? null,
    stocked,
    reserved,
    available,
    threshold,
    has_custom_threshold: custom,
    location_id: (inventoryItem.location_levels || [])[0]?.location_id ?? null,
  }

  if (available <= 0) {
    return { bucket: "out", row }
  }
  if (available <= threshold) {
    return { bucket: "low", row }
  }
  return { bucket: "ok", row }
}

/**
 * Variant ids that are made to order, so they can be excluded.
 *
 * §10 assumes made-to-order variants carry `manage_inventory = false`, which
 * P6-6 will enforce — but it has not run yet, and the check that would confirm
 * it (P0-1) needs production access. Reading the production profiles instead
 * makes the exclusion correct either way rather than dependent on that cleanup.
 */
const madeToOrderVariantIds = async (
  container: MedusaContainer
): Promise<Set<string>> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const excluded = new Set<string>()

  const { data: productProfiles } = await query.graph({
    entity: "product_production_profile",
    fields: ["product_id", "enabled"],
  })
  const madeToOrderProductIds = productProfiles
    .filter((profile: any) => profile?.enabled)
    .map((profile: any) => profile.product_id)

  if (madeToOrderProductIds.length) {
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id"],
      filters: { product_id: madeToOrderProductIds },
    })
    for (const variant of variants) {
      excluded.add(variant.id)
    }
  }

  const { data: variantProfiles } = await query.graph({
    entity: "variant_production_profile",
    fields: ["variant_id"],
  })
  for (const profile of variantProfiles as any[]) {
    if (profile?.variant_id) {
      excluded.add(profile.variant_id)
    }
  }

  return excluded
}

/**
 * Every variant that is running low or has run out, with the threshold that
 * decided it. Both lists come from one pass, because the two Sklad pages and
 * the Přehled tiles always want them together.
 */
export const getInventoryAlerts = async (
  container: MedusaContainer
): Promise<InventoryAlerts> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const settings = await getMerchantSettings(container)
  const defaultThreshold = settings.low_stock_default_threshold

  const [excludedVariantIds, { data: variants }] = await Promise.all([
    madeToOrderVariantIds(container),
    query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "title",
        "sku",
        "manage_inventory",
        "product.id",
        "product.title",
        "product.status",
        "inventory.id",
        "inventory.metadata",
        "inventory.location_levels.location_id",
        "inventory.location_levels.stocked_quantity",
        "inventory.location_levels.reserved_quantity",
      ],
    }),
  ])

  const low: InventoryAlertRow[] = []
  const out: InventoryAlertRow[] = []
  const ok: InventoryAlertRow[] = []

  for (const variant of variants as any[]) {
    const classified = classifyVariant(
      variant,
      defaultThreshold,
      excludedVariantIds
    )
    if (!classified) {
      continue
    }
    const bucket =
      classified.bucket === "out" ? out : classified.bucket === "low" ? low : ok
    bucket.push(classified.row)
  }

  // Fewest pieces first — that is the order she would act in.
  low.sort((a, b) => a.available - b.available)
  out.sort((a, b) =>
    (a.product_title ?? "").localeCompare(b.product_title ?? "", "cs")
  )

  ok.sort((a, b) =>
    (a.product_title ?? "").localeCompare(b.product_title ?? "", "cs")
  )

  return { low, out, ok, default_threshold: defaultThreshold }
}
