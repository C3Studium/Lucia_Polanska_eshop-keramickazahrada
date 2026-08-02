import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import BundledProductModuleService from "../../modules/bundled-product/service"
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product"

type CreateBundleStepInput = {
  title: string
  pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price"
  discount_percentage?: number | null
}

export const createBundleStep = createStep(
  "create-bundle",
  async (input: CreateBundleStepInput, { container }) => {
    const bundledProductModuleService: BundledProductModuleService =
      container.resolve(BUNDLED_PRODUCT_MODULE)

    const bundle = await bundledProductModuleService.createBundles({
      title: input.title,
      pricing_mode: input.pricing_mode ?? "component_sum",
      discount_percentage: input.discount_percentage ?? null,
    })

    return new StepResponse(bundle, bundle.id)
  },
  async (bundleId, { container }) => {
    if (!bundleId) {
      return
    }
    const bundledProductModuleService: BundledProductModuleService =
      container.resolve(BUNDLED_PRODUCT_MODULE)
      
    await bundledProductModuleService.deleteBundles(bundleId)
  }
)
