import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product"
import BundledProductModuleService from "../../modules/bundled-product/service"

type DeleteBundleRecordsInput = {
  bundle_id: string
  item_ids: string[]
}

export const deleteBundleRecordsStep = createStep(
  "delete-bundle-records",
  async (input: DeleteBundleRecordsInput, { container }) => {
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    if (input.item_ids.length) {
      await service.deleteBundleItems(input.item_ids)
    }
    await service.deleteBundles(input.bundle_id)
    return new StepResponse(void 0, input)
  },
  async (input, { container }) => {
    if (!input) {
      return
    }
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    await (service as any).restoreBundles(input.bundle_id)
    if (input.item_ids.length) {
      await (service as any).restoreBundleItems(input.item_ids)
    }
  }
)
