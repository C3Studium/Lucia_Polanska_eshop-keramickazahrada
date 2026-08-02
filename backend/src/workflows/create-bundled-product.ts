import { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createBundleStep } from "./steps/create-bundle"
import { createBundleItemsStep } from "./steps/create-bundle-items"
import { acquireLockStep, createProductsWorkflow, createRemoteLinkStep, releaseLockStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { BUNDLED_PRODUCT_MODULE } from "../modules/bundled-product"
import { Modules } from "@medusajs/framework/utils"
import { validateBundleDefinitionStep } from "./steps/validate-bundle-definition"

export type CreateBundledProductWorkflowInput = {
  bundle: {
    title: string
    pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price"
    discount_percentage?: number | null
    product: CreateProductWorkflowInputDTO
    items: {
      product_id: string
      quantity: number
      display_order?: number
      variant_mode?: "customer_selects" | "fixed_variant"
      fixed_variant_id?: string | null
    }[]
  }
}

export const createBundledProductWorkflow = createWorkflow(
  "create-bundled-product",
  ({ bundle: bundleData }: CreateBundledProductWorkflowInput) => {
    const lockKey = transform({ bundleData }, ({ bundleData }) =>
      `bundle:create:${bundleData.product.handle || bundleData.title}`
    )
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 60 })

    validateBundleDefinitionStep({
      pricing_mode: bundleData.pricing_mode,
      discount_percentage: bundleData.discount_percentage,
      items: bundleData.items,
    })

    const bundle = createBundleStep({
      title: bundleData.title,
      pricing_mode: bundleData.pricing_mode,
      discount_percentage: bundleData.discount_percentage,
    })

    const bundleItems = createBundleItemsStep({
      bundle_id: bundle.id,
      items: bundleData.items,
    })
    
    const bundleProduct = createProductsWorkflow.runAsStep({
      input: {
        products: [bundleData.product],
      },
    })

    createRemoteLinkStep([{
      [BUNDLED_PRODUCT_MODULE]: {
        bundle_id: bundle.id,
      },
      [Modules.PRODUCT]: {
        product_id: bundleProduct[0].id,
      },
    }])

    const bundleProductItemLinks = transform({
      bundleData,
      bundleItems,
    }, (data) => {
      return data.bundleItems.flatMap((item, index) => {
        const input = data.bundleData.items[index]
        const links: Record<string, any>[] = [{
          [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: item.id },
          [Modules.PRODUCT]: { product_id: input.product_id },
        }]

        if (input.variant_mode === "fixed_variant" && input.fixed_variant_id) {
          links.push({
            [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: item.id },
            [Modules.PRODUCT]: { product_variant_id: input.fixed_variant_id },
          })
        }

        return links
      })
    })

    createRemoteLinkStep(bundleProductItemLinks).config({
      name: "create-bundle-product-items-links",
    })

    // retrieve bundled product with items
    const { data } = useQueryGraphStep({
      entity: "bundle",
      fields: ["*", "product.*", "items.*", "items.product.*", "items.product_variant.*"],
      filters: {
        id: bundle.id,
      },
    })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(data[0])
  }
)
