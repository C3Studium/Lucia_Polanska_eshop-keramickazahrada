import { UpdateProductWorkflowInputDTO } from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  releaseLockStep,
  updateProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { replaceBundleItemsStep } from "./steps/replace-bundle-items"
import { updateBundleRecordStep } from "./steps/update-bundle-record"
import {
  BundleDefinitionItem,
  validateBundleDefinitionStep,
} from "./steps/validate-bundle-definition"

export type UpdateBundledProductWorkflowInput = {
  id: string
  title?: string
  pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price"
  discount_percentage?: number | null
  product?: UpdateProductWorkflowInputDTO
  items?: BundleDefinitionItem[]
}

export const updateBundledProductWorkflow = createWorkflow(
  "update-bundled-product",
  (input: UpdateBundledProductWorkflowInput) => {
    const lockKey = transform({ input }, ({ input }) => `bundle:${input.id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 60 })

    const { data: existing } = useQueryGraphStep({
      entity: "bundle",
      fields: ["id", "product.id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-existing-bundle" })

    when("validate-replacement-bundle-items", { input }, ({ input }) =>
      Array.isArray(input.items)
    ).then(() =>
      validateBundleDefinitionStep({
        pricing_mode: input.pricing_mode,
        discount_percentage: input.discount_percentage,
        items: input.items!,
      })
    )

    updateBundleRecordStep({
      id: input.id,
      title: input.title,
      pricing_mode: input.pricing_mode,
      discount_percentage: input.discount_percentage,
    })

    when("update-bundle-product-record", { input }, ({ input }) => !!input.product).then(
      () => {
        const productUpdate = transform(
          { existing, input },
          ({ existing, input }) => ({
            selector: { id: existing[0].product.id },
            update: input.product!,
          })
        )
        return updateProductsWorkflow.runAsStep({ input: productUpdate })
      }
    )

    when("replace-bundle-items", { input }, ({ input }) =>
      Array.isArray(input.items)
    ).then(() =>
      replaceBundleItemsStep({
        bundle_id: input.id,
        items: input.items!,
      })
    )

    const { data } = useQueryGraphStep({
      entity: "bundle",
      fields: [
        "*",
        "product.*",
        "product.images.*",
        "items.*",
        "items.product.*",
        "items.product_variant.*",
      ],
      filters: { id: input.id },
    }).config({ name: "refetch-updated-bundle" })

    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(data[0])
  }
)
