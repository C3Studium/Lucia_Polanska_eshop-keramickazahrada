import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  orderEditAddNewItemWorkflow,
  orderEditUpdateItemQuantityWorkflow,
} from "@medusajs/medusa/core-flows"
import { lineQuantityOf, toNumber } from "../order-quantity"
import {
  cnbSheetCached,
  isPackagingLine,
  packagingPriceCzkOf,
  packagingUnitPrice,
  PACKAGING_MARKER,
  PACKAGING_PRODUCT_KEY,
  PACKAGING_VARIANT_KEY,
  planPackaging,
  type PackagingLineLike,
} from "../packaging"

/**
 * Balné v rozpracované úpravě objednávky (lib/packaging.ts): po akcích
 * zákazníka (přidat, odebrat, počet, výměna) se srovnají i položky balného —
 * přidaný výrobek dostane své balné, odebraný o něj přijde, změněný počet
 * kusů se promítne. Rozdíl úpravy (doplatek / vrácení) ho tak obsahuje.
 *
 * Cena balení u výrobku, který v objednávce UŽ byl, zůstává ta zaplacená
 * (mění se jen počet kusů); nový výrobek dostane dnešní cenu balení.
 *
 * Vrací `true`, když přidal akce (volající pak znovu načte náhled).
 */
export const applyPackagingRecalculation = async (
  container: MedusaContainer,
  order: any,
  preview: any
): Promise<boolean> => {
  const items = ((preview?.items ?? []) as any[]).map((item) => ({
    ...item,
    quantity: lineQuantityOf(item),
  })) as PackagingLineLike[]

  // Zaplacená cena balení u variant, které balné už mají.
  const paidUnit = new Map<string, number>()
  for (const line of items.filter(isPackagingLine)) {
    const key = String(line.metadata?.[PACKAGING_VARIANT_KEY] ?? "")
    if (key && !paidUnit.has(key)) paidUnit.set(key, toNumber(line.unit_price))
  }

  const productIds = [
    ...new Set(items.filter((item) => !isPackagingLine(item)).map((item) => item.product_id).filter(Boolean)),
  ] as string[]
  const metadataByProduct = new Map<string, Record<string, unknown> | null>()
  if (productIds.length) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      filters: { id: productIds },
    })
    for (const product of data as any[]) metadataByProduct.set(product.id, product.metadata ?? null)
  }

  const currency = String(order.currency_code ?? "czk").toLowerCase()
  const sheet = currency === "czk" ? null : await cnbSheetCached()
  const plan = planPackaging({
    items,
    unitPriceFor: (item) => {
      const paid = paidUnit.get(String(item.variant_id))
      if (paid !== undefined) return paid
      return packagingUnitPrice(
        packagingPriceCzkOf(metadataByProduct.get(String(item.product_id)) ?? null),
        currency,
        sheet
      )
    },
  })

  // V úpravě jde jen o počet kusů — název a cena zaplaceného balného zůstávají.
  const quantityUpdates = [
    ...plan.remove_ids.map((id) => ({ id, quantity: 0 })),
    ...plan.update.filter((entry) => entry.quantity_changed).map((entry) => ({ id: entry.id, quantity: entry.quantity })),
  ]
  if (!quantityUpdates.length && !plan.add.length) return false

  if (quantityUpdates.length) {
    await orderEditUpdateItemQuantityWorkflow(container).run({
      input: { order_id: order.id, items: quantityUpdates } as never,
    })
  }
  if (plan.add.length) {
    await orderEditAddNewItemWorkflow(container).run({
      input: {
        order_id: order.id,
        items: plan.add.map((entry) => ({
          title: entry.title,
          quantity: entry.quantity,
          unit_price: entry.unit_price,
          metadata: {
            [PACKAGING_MARKER]: true,
            [PACKAGING_VARIANT_KEY]: entry.variant_id,
            ...(entry.product_id ? { [PACKAGING_PRODUCT_KEY]: entry.product_id } : {}),
          },
        })),
      } as never,
    })
  }
  return true
}
