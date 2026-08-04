import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { updateSeasonalSelectionWorkflow } from "../workflows/manage-seasonal-selection"
import { isClearanceProduct, isSoldOut } from "../lib/clearance"
import { notifyMerchant } from "../lib/notify"

/**
 * Takes sold-out clearance pieces out of the shop, and out of their sale.
 *
 * A damaged piece is sold once and never remade, so „vyprodáno" is permanent
 * rather than a restocking task. Left alone it becomes a listing nobody can buy
 * and a discount advertising something that no longer exists — and if it sat in
 * a sezónní akce, the sale keeps pointing at it.
 *
 * The job unpublishes the product and removes it from any seasonal sale it was
 * part of. It never touches an ordinary product: running out of a mug she makes
 * every week is a restocking prompt, and hiding it would be actively wrong.
 *
 * Runs hourly rather than on the inventory event, because the interesting
 * moment is „the reservation resolved and it is really gone", which is a
 * settling state rather than a single event.
 */

export default async function retireSoldOutClearance(
  container: MedusaContainer
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "status",
      "metadata",
      "variants.id",
      "variants.manage_inventory",
      "variants.inventory.location_levels.stocked_quantity",
      "variants.inventory.location_levels.reserved_quantity",
    ],
    filters: { status: "published" },
  })

  const retired = (products as any[]).filter(
    (product) => isClearanceProduct(product) && isSoldOut(product.variants)
  )

  if (!retired.length) {
    return
  }

  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: retired.map((product) => product.id) },
      update: { status: "draft" },
    },
  })

  // Take them out of any sale that still advertises them.
  const { data: selections } = await query.graph({
    entity: "seasonal_selection",
    fields: ["id", "title", "publication_status", "items.id", "items.product_id"],
  })

  const retiredIds = new Set(retired.map((product) => product.id))

  for (const selection of selections as any[]) {
    if (selection.publication_status === "archived") {
      continue
    }
    const remaining = (selection.items || []).filter(
      (item: any) => !retiredIds.has(item.product_id)
    )
    if (remaining.length === (selection.items || []).length) {
      continue
    }

    await updateSeasonalSelectionWorkflow(container).run({
      input: {
        id: selection.id,
        items: remaining.map((item: any) => ({ product_id: item.product_id })),
      },
    })
  }

  logger.info(
    `[clearance] ${retired.length} vyprodaných kusů z výprodeje bylo skryto a odebráno z akcí.`
  )

  await notifyMerchant(container, {
    key: `mn:clearance-retired:${new Date().toISOString().slice(0, 13)}`,
    title:
      retired.length === 1
        ? "Kus z výprodeje je pryč"
        : `${retired.length} kusů z výprodeje je pryč`,
    description: `${retired
      .map((product) => product.title)
      .slice(0, 5)
      .join(", ")} — schovali jsme je z e-shopu, protože se už nevyrobí.`,
    audience: "owner",
  })
}

export const config = {
  name: "retire-sold-out-clearance",
  schedule: "20 * * * *",
}
