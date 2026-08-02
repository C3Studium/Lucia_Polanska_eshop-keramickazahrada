import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MERCHANT_CATALOG_MODULE } from "../../modules/merchant-catalog"
import MerchantCatalogModuleService from "../../modules/merchant-catalog/service"

export const deleteCollectionMerchandisingStep = createStep(
  "delete-collection-merchandising",
  async ({ collection_id }: { collection_id: string }, { container }) => {
    const service: MerchantCatalogModuleService = container.resolve(
      MERCHANT_CATALOG_MODULE
    )
    const profiles = await service.listCollectionProfiles({ collection_id })
    const assignments = await service.listCollectionCategoryAssignments({ collection_id })
    if (assignments.length) {
      await service.deleteCollectionCategoryAssignments(assignments.map((item) => item.id))
    }
    if (profiles.length) {
      await service.deleteCollectionProfiles(profiles.map((item) => item.id))
    }
    return new StepResponse(void 0, {
      profile_ids: profiles.map((item) => item.id),
      assignment_ids: assignments.map((item) => item.id),
    })
  },
  async (snapshot, { container }) => {
    if (!snapshot) {
      return
    }
    const service: MerchantCatalogModuleService = container.resolve(
      MERCHANT_CATALOG_MODULE
    ) as any
    if (snapshot.profile_ids.length) {
      await service.restoreCollectionProfiles(snapshot.profile_ids)
    }
    if (snapshot.assignment_ids.length) {
      await service.restoreCollectionCategoryAssignments(snapshot.assignment_ids)
    }
  }
)
