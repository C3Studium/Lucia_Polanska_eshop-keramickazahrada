import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { addToCartWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { prepareBundleCartDataStep, PrepareBundleCartDataStepInput } from "./steps/prepare-bundle-cart-data"
import { QueryContext } from "@medusajs/framework/utils"

type AddBundleToCartWorkflowInput = {
  cart_id: string
  bundle_id: string
  quantity: number
  items: {
    item_id: string
    variant_id: string
  }[]
}

export const addBundleToCartWorkflow = createWorkflow(
  "add-bundle-to-cart",
  ({ cart_id, bundle_id, quantity, items }: AddBundleToCartWorkflowInput) => {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["id", "region_id", "currency_code"],
      filters: { id: cart_id },
      options: { throwIfKeyNotFound: true },
    })

    const { data } = useQueryGraphStep({
      entity: "bundle",
      fields: [
        "*",
        "product.id",
        "product.variants.id",
        "product.variants.calculated_price.*",
        "items.*",
        "items.product.*",
        "items.product.variants.*",
        "items.product.variants.calculated_price.*",
        "items.product_variant.*",
        "items.product_variant.calculated_price.*",
      ],
      filters: {
        id: bundle_id
      },
      options: {
        throwIfKeyNotFound: true
      },
      context: {
        product: {
          variants: {
            calculated_price: QueryContext({
              region_id: carts[0].region_id,
              currency_code: carts[0].currency_code,
            }),
          },
        },
        items: {
          product: {
            variants: {
              calculated_price: QueryContext({
                region_id: carts[0].region_id,
                currency_code: carts[0].currency_code,
              }),
            },
          },
          product_variant: {
            calculated_price: QueryContext({
              region_id: carts[0].region_id,
              currency_code: carts[0].currency_code,
            }),
          },
        },
      }
    })
    
    const itemsToAdd = prepareBundleCartDataStep({
      bundle: data[0],
      quantity,
      items,
      currency_code: carts[0].currency_code,
    } as unknown as PrepareBundleCartDataStepInput)

    addToCartWorkflow.runAsStep({
      input: {
        cart_id,
        items: itemsToAdd
      }
    })

    const { data: updatedCarts } = useQueryGraphStep({
      entity: "cart",
      filters: { id: cart_id },
      fields: ["id", "items.*"],
    }).config({ name: "refetch-cart" })

    return new WorkflowResponse(updatedCarts[0])
  }
)
