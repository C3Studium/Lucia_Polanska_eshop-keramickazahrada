import { InferTypeOf, ProductDTO } from "@medusajs/framework/types"
import { Bundle } from "../../modules/bundled-product/models/bundle"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { BundleItem } from "../../modules/bundled-product/models/bundle-item"
import { randomUUID } from "node:crypto"

type BundleItemWithProduct = InferTypeOf<typeof BundleItem> & {
  product: ProductDTO
  product_variant?: any
}

export type PrepareBundleCartDataStepInput = {
  bundle: InferTypeOf<typeof Bundle> & {
    items: BundleItemWithProduct[]
    product?: ProductDTO
  }
  quantity: number
  currency_code?: string
  items: {
    item_id: string
    variant_id: string
  }[]
}

export const prepareBundleCartDataStep = createStep(
  "prepare-bundle-cart-data",
  async ({ bundle, quantity, items }: PrepareBundleCartDataStepInput) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Bundle quantity must be a positive integer."
      )
    }

    const duplicateSelection = items.find(
      (selection, index) => items.findIndex((item) => item.item_id === selection.item_id) !== index
    )
    if (duplicateSelection) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Bundle item ${duplicateSelection.item_id} was selected more than once.`
      )
    }

    const knownItemIds = new Set(bundle.items.map((item: any) => item.id))
    const unknownSelection = items.find((selection) => !knownItemIds.has(selection.item_id))
    if (unknownSelection) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Bundle item ${unknownSelection.item_id} is not part of this bundle.`
      )
    }

    const sortedItems = [...bundle.items].sort(
      (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
    )
    const resolved = sortedItems.map((item: BundleItemWithProduct) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const selectedItem = items.find((i) => i.item_id === item.id)
      const fixedVariant = Array.isArray(item.product_variant)
        ? item.product_variant[0]
        : item.product_variant
      const variantId = item.variant_mode === "fixed_variant"
        ? fixedVariant?.id
        : selectedItem?.variant_id

      if (!variantId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA, 
          item.variant_mode === "fixed_variant"
            ? `Bundle item ${item.id} has no configured fixed variant.`
            : `No variant selected for bundle item ${item.id}.`
        )
      }

      if (
        item.variant_mode === "fixed_variant" &&
        selectedItem &&
        selectedItem.variant_id !== variantId
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Bundle item ${item.id} uses a fixed variant and cannot be overridden.`
        )
      }

      const variant = product?.variants?.find((v: any) => v.id === variantId)
      if (!variant) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA, 
          `Variant ${variantId} is invalid for bundle item ${item.id}.`
        )
      }

      const requestedQuantity = item.quantity * quantity
      if (
        variant.manage_inventory &&
        !variant.allow_backorder &&
        Number.isFinite(Number((variant as any).inventory_quantity)) &&
        Number((variant as any).inventory_quantity) < requestedQuantity
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Variant ${variantId} is not available in the requested bundle quantity.`
        )
      }

      const calculatedAmount = Number((variant as any).calculated_price?.calculated_amount)
      if (!Number.isFinite(calculatedAmount)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant ${variantId} has no price for this cart.`
        )
      }

      return { item, product, variant, variantId, requestedQuantity, calculatedAmount }
    })

    const componentTotal = resolved.reduce(
      (sum, entry) => sum + entry.calculatedAmount * entry.item.quantity,
      0
    )
    let targetBundlePrice = componentTotal
    if (bundle.pricing_mode === "component_sum_discount") {
      targetBundlePrice = Math.round(
        componentTotal * (1 - Number(bundle.discount_percentage ?? 0) / 100)
      )
    } else if (bundle.pricing_mode === "fixed_price") {
      const bundleProduct = Array.isArray(bundle.product) ? bundle.product[0] : bundle.product
      const fixedAmount = Number(
        (bundleProduct as any)?.variants?.[0]?.calculated_price?.calculated_amount
      )
      if (!Number.isFinite(fixedAmount)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "The bundle has no fixed price for this cart."
        )
      }
      targetBundlePrice = fixedAmount
    }

    const groupId = randomUUID()
    const bundleItems = resolved.map((entry) => {
      const unitPrice = bundle.pricing_mode === "component_sum"
        ? undefined
        : componentTotal > 0
          ? Math.max(0, Math.round(
              entry.calculatedAmount * (targetBundlePrice / componentTotal)
            ))
          : 0
      return {
        variant_id: entry.variantId,
        quantity: entry.requestedQuantity,
        ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
        metadata: {
          bundle_id: bundle.id,
          bundle_title: bundle.title,
          bundle_group_id: groupId,
          bundle_quantity: quantity,
          bundle_item_id: entry.item.id,
          bundle_item_order: entry.item.display_order,
          bundle_item_quantity: entry.item.quantity,
          bundle_variant_mode: entry.item.variant_mode,
          bundle_selected_variant_id: entry.variantId,
          bundle_selected_variant_title: entry.variant.title,
          bundle_component_product_id: entry.product.id,
          bundle_pricing_mode: bundle.pricing_mode,
          bundle_discount_percentage: bundle.discount_percentage,
          bundle_component_unit_price: entry.calculatedAmount,
          bundle_target_price: targetBundlePrice,
        }
      }
    })

    return new StepResponse(bundleItems)
  }  
)
