import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product"
import BundledProductModuleService from "../../modules/bundled-product/service"

type UpdateBundleRecordInput = {
  id: string
  title?: string
  pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price"
  discount_percentage?: number | null
}

export const updateBundleRecordStep = createStep(
  "update-bundle-record",
  async (input: UpdateBundleRecordInput, { container }) => {
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    const existing = await service.retrieveBundle(input.id)
    const update = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as UpdateBundleRecordInput
    const updated = await service.updateBundles(update)

    return new StepResponse(updated, {
      id: existing.id,
      title: existing.title,
      pricing_mode: existing.pricing_mode,
      discount_percentage: existing.discount_percentage,
    })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    await service.updateBundles(previous)
  }
)
