import type { MetadataType } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createCollectionsWorkflow,
  deleteCollectionsWorkflow,
  releaseLockStep,
  updateCollectionsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { deleteCollectionMerchandisingStep } from "./steps/delete-collection-merchandising"
import {
  CollectionCategoryInput,
  CollectionProfileInput,
  upsertCollectionMerchandisingStep,
} from "./steps/upsert-collection-merchandising"

export type CreateMerchantCollectionInput = {
  title: string
  handle?: string
  product_ids?: string[]
  metadata?: MetadataType
  profile?: CollectionProfileInput
  categories?: CollectionCategoryInput[]
}

export type UpdateMerchantCollectionInput = {
  id: string
  title?: string
  handle?: string
  product_ids?: string[]
  metadata?: MetadataType | null
  profile?: CollectionProfileInput
  categories?: CollectionCategoryInput[]
}

export const createMerchantCollectionWorkflow = createWorkflow(
  "create-merchant-collection",
  (input: CreateMerchantCollectionInput) => {
    const lockKey = transform({ input }, ({ input }) =>
      `merchant-collection:create:${input.handle || input.title}`
    )
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 45 })
    const collections = createCollectionsWorkflow.runAsStep({
      input: {
        collections: [{
          title: input.title,
          handle: input.handle,
          product_ids: input.product_ids,
          metadata: input.metadata,
        }],
      },
    })
    upsertCollectionMerchandisingStep({
      collection_id: collections[0].id,
      profile: input.profile,
      categories: input.categories ?? [],
      ensure_profile: true,
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(collections[0])
  }
)

export const updateMerchantCollectionWorkflow = createWorkflow(
  "update-merchant-collection",
  (input: UpdateMerchantCollectionInput) => {
    const lockKey = transform({ input }, ({ input }) => `merchant-collection:${input.id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 45 })
    useQueryGraphStep({
      entity: "product_collection",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-collection-details" })

    const hasNativeUpdate = transform({ input }, ({ input }) =>
      input.title !== undefined ||
      input.handle !== undefined ||
      input.product_ids !== undefined ||
      input.metadata !== undefined
    )
    when("update-native-merchant-collection", { hasNativeUpdate }, ({ hasNativeUpdate }) =>
      hasNativeUpdate
    ).then(() =>
      updateCollectionsWorkflow.runAsStep({
        input: {
          selector: { id: input.id },
          update: {
            title: input.title,
            handle: input.handle,
            product_ids: input.product_ids,
            metadata: input.metadata,
          },
        },
      })
    )

    upsertCollectionMerchandisingStep({
      collection_id: input.id,
      profile: input.profile,
      categories: input.categories,
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse({ id: input.id })
  }
)

export const deleteMerchantCollectionWorkflow = createWorkflow(
  "delete-merchant-collection",
  ({ id }: { id: string }) => {
    const lockKey = transform({ id }, ({ id }) => `merchant-collection:${id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 45 })
    useQueryGraphStep({
      entity: "product_collection",
      fields: ["id"],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-collection-to-delete" })
    deleteCollectionMerchandisingStep({ collection_id: id })
    deleteCollectionsWorkflow.runAsStep({ input: { ids: [id] } })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse({ id, deleted: true })
  }
)
