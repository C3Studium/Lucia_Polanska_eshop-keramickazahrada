import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product"
import BundledProductModuleService from "../../modules/bundled-product/service"

type CreateBundleItemsStepInput = {
  bundle_id: string
  items: {
    quantity: number
    display_order?: number
    variant_mode?: "customer_selects" | "fixed_variant"
  }[]
}

export const createBundleItemsStep = createStep(
  "create-bundle-items",
  async ({ bundle_id, items }: CreateBundleItemsStepInput, { container }) => {
    const bundledProductModuleService: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )

    const bundleItems = await bundledProductModuleService.createBundleItems(
      items.map((item, index) => ({
        bundle_id,
        quantity: item.quantity,
        display_order: item.display_order ?? index,
        variant_mode: item.variant_mode ?? "customer_selects",
      }))
    )

    return new StepResponse(bundleItems, bundleItems.map(item => item.id))
  },
  async (itemIds, { container }) => {
    if (!itemIds?.length) {
      return
    }

    const bundledProductModuleService: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )

    await bundledProductModuleService.deleteBundleItems(itemIds)
  }
)
