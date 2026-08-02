import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  deleteProductsWorkflow,
  dismissRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { BUNDLED_PRODUCT_MODULE } from "../modules/bundled-product"
import { deleteBundleRecordsStep } from "./steps/delete-bundle-records"

export const deleteBundledProductWorkflow = createWorkflow(
  "delete-bundled-product",
  ({ id }: { id: string }) => {
    const lockKey = transform({ id }, ({ id }) => `bundle:${id}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 60 })

    const { data } = useQueryGraphStep({
      entity: "bundle",
      fields: [
        "id",
        "product.id",
        "items.id",
        "items.product.id",
        "items.product_variant.id",
      ],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-bundle-details" })

    const links = transform({ data }, ({ data }) => {
      const bundle = data[0]
      const itemLinks = (bundle.items ?? []).flatMap((item: any) => [
        {
          [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: item.id },
          [Modules.PRODUCT]: { product_id: item.product.id },
        },
        ...(item.product_variant?.id
          ? [{
              [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: item.id },
              [Modules.PRODUCT]: { product_variant_id: item.product_variant.id },
            }]
          : []),
      ])
      return [
        ...itemLinks,
        {
          [BUNDLED_PRODUCT_MODULE]: { bundle_id: bundle.id },
          [Modules.PRODUCT]: { product_id: bundle.product.id },
        },
      ]
    })
    dismissRemoteLinkStep(links)

    const productIds = transform({ data }, ({ data }) =>
      data[0]?.product?.id ? [data[0].product.id] : []
    )
    when("delete-bundle-product", { productIds }, ({ productIds }) =>
      productIds.length > 0
    ).then(() => deleteProductsWorkflow.runAsStep({ input: { ids: productIds } }))

    const records = transform({ data }, ({ data }) => ({
      bundle_id: data[0].id,
      item_ids: (data[0].items ?? []).map((item: any) => item.id),
    }))
    deleteBundleRecordsStep(records)
    releaseLockStep({ key: lockKey })

    return new WorkflowResponse({ id, deleted: true })
  }
)
