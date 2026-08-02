import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { MERCHANT_CATALOG_MODULE } from "../../modules/merchant-catalog"
import MerchantCatalogModuleService from "../../modules/merchant-catalog/service"

export type CollectionProfileInput = {
  description?: string | null
  cover_image_url?: string | null
  mobile_image_url?: string | null
  storefront_visible?: boolean
  display_order?: number
  seo_title?: string | null
  seo_description?: string | null
}

export type CollectionCategoryInput = {
  category_id: string
  display_order?: number
}

type UpsertCollectionMerchandisingInput = {
  collection_id: string
  profile?: CollectionProfileInput
  categories?: CollectionCategoryInput[]
  ensure_profile?: boolean
}

type Snapshot = {
  profile_id?: string
  previous_profile?: Record<string, any>
  created_profile_id?: string
  previous_assignments: Record<string, any>[]
  created_assignment_ids: string[]
  categories_replaced: boolean
}

const profileFields = [
  "description",
  "cover_image_url",
  "mobile_image_url",
  "storefront_visible",
  "display_order",
  "seo_title",
  "seo_description",
] as const

export const upsertCollectionMerchandisingStep = createStep(
  "upsert-collection-merchandising",
  async (input: UpsertCollectionMerchandisingInput, { container }) => {
    const service: MerchantCatalogModuleService = container.resolve(
      MERCHANT_CATALOG_MODULE
    )
    const existingProfiles = await service.listCollectionProfiles({
      collection_id: input.collection_id,
    })
    const existingProfile = existingProfiles[0]
    const existingAssignments = await service.listCollectionCategoryAssignments({
      collection_id: input.collection_id,
    })
    const snapshot: Snapshot = {
      profile_id: existingProfile?.id,
      previous_profile: existingProfile
        ? Object.fromEntries(profileFields.map((key) => [key, (existingProfile as any)[key]]))
        : undefined,
      previous_assignments: existingAssignments.map((assignment: any) => ({
        id: assignment.id,
        collection_id: assignment.collection_id,
        category_id: assignment.category_id,
        display_order: assignment.display_order,
      })),
      created_assignment_ids: [],
      categories_replaced: input.categories !== undefined,
    }

    try {
      if (input.profile || input.ensure_profile) {
        if (existingProfile) {
          await service.updateCollectionProfiles({
            id: existingProfile.id,
            ...(input.profile ?? {}),
          })
        } else {
          const created = await service.createCollectionProfiles({
            collection_id: input.collection_id,
            ...(input.profile ?? {}),
          })
          snapshot.created_profile_id = created.id
        }
      }

      if (input.categories !== undefined) {
        const query = container.resolve("query")
        const categoryIds = [...new Set(input.categories.map((item) => item.category_id))]
        const { data: categories } = categoryIds.length
          ? await query.graph({
              entity: "product_category",
              fields: ["id"],
              filters: { id: categoryIds },
            })
          : { data: [] }
        if (categories.length !== categoryIds.length) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "One or more selected product categories do not exist."
          )
        }

        const allAssignments = await service.listCollectionCategoryAssignments({})
        const occupied = new Map(
          allAssignments.map((assignment: any) => [assignment.category_id, assignment])
        )
        const conflict = input.categories.find((item) => {
          const assignment: any = occupied.get(item.category_id)
          return assignment && assignment.collection_id !== input.collection_id
        })
        if (conflict) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Category ${conflict.category_id} is already assigned to another collection.`
          )
        }

        if (existingAssignments.length) {
          await service.deleteCollectionCategoryAssignments(
            existingAssignments.map((assignment) => assignment.id)
          )
        }
        if (input.categories.length) {
          const created = await service.createCollectionCategoryAssignments(
            input.categories.map((item, index) => ({
              collection_id: input.collection_id,
              category_id: item.category_id,
              display_order: item.display_order ?? index,
            }))
          )
          snapshot.created_assignment_ids = created.map((assignment) => assignment.id)
        }
      }
    } catch (error) {
      if (snapshot.created_assignment_ids.length) {
        await service.deleteCollectionCategoryAssignments(
          snapshot.created_assignment_ids,
          { hardDelete: true } as any
        ).catch(() => undefined)
      }
      if (snapshot.categories_replaced && snapshot.previous_assignments.length) {
        await (service as any).restoreCollectionCategoryAssignments(
          snapshot.previous_assignments.map((assignment) => assignment.id)
        ).catch(() => undefined)
      }
      if (snapshot.created_profile_id) {
        await service.deleteCollectionProfiles(snapshot.created_profile_id, {
          hardDelete: true,
        } as any).catch(() => undefined)
      } else if (snapshot.profile_id && snapshot.previous_profile) {
        await service.updateCollectionProfiles({
          id: snapshot.profile_id,
          ...snapshot.previous_profile,
        }).catch(() => undefined)
      }
      throw error
    }

    return new StepResponse(void 0, snapshot)
  },
  async (snapshot, { container }) => {
    if (!snapshot) {
      return
    }
    const service: MerchantCatalogModuleService = container.resolve(
      MERCHANT_CATALOG_MODULE
    )
    if (snapshot.created_assignment_ids.length) {
      await service.deleteCollectionCategoryAssignments(
        snapshot.created_assignment_ids,
        { hardDelete: true } as any
      )
    }
    if (snapshot.categories_replaced && snapshot.previous_assignments.length) {
      await (service as any).restoreCollectionCategoryAssignments(
        snapshot.previous_assignments.map((assignment) => assignment.id)
      )
    }
    if (snapshot.created_profile_id) {
      await service.deleteCollectionProfiles(snapshot.created_profile_id, {
        hardDelete: true,
      } as any)
    } else if (snapshot.profile_id && snapshot.previous_profile) {
      await service.updateCollectionProfiles({
        id: snapshot.profile_id,
        ...snapshot.previous_profile,
      })
    }
  }
)
