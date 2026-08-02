import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

export type BundleDefinitionItem = {
  product_id: string
  quantity: number
  display_order?: number
  variant_mode?: "customer_selects" | "fixed_variant"
  fixed_variant_id?: string | null
}

type ValidateBundleDefinitionInput = {
  pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price"
  discount_percentage?: number | null
  items: BundleDefinitionItem[]
}

export const validateBundleDefinitionStep = createStep(
  "validate-bundle-definition",
  async (input: ValidateBundleDefinitionInput, { container }) => {
    if (!input.items.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A bundle must contain at least one product."
      )
    }

    if (
      input.pricing_mode === "component_sum_discount" &&
      (!Number.isFinite(input.discount_percentage) ||
        Number(input.discount_percentage) <= 0 ||
        Number(input.discount_percentage) >= 100)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A component-sum discount must be greater than 0 and lower than 100."
      )
    }

    const productIds = [...new Set(input.items.map((item) => item.product_id))]
    const query = container.resolve("query")
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "status", "variants.id"],
      filters: { id: productIds },
    })

    const productsById = new Map(products.map((product: any) => [product.id, product]))
    for (const item of input.items) {
      const product: any = productsById.get(item.product_id)
      if (!product) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Product ${item.product_id} does not exist.`
        )
      }

      if (item.variant_mode === "fixed_variant") {
        if (!item.fixed_variant_id) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Bundle item for product ${item.product_id} requires a fixed variant.`
          )
        }

        const ownsVariant = product.variants?.some(
          (variant: any) => variant.id === item.fixed_variant_id
        )
        if (!ownsVariant) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Variant ${item.fixed_variant_id} does not belong to product ${item.product_id}.`
          )
        }
      } else if (item.fixed_variant_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `A customer-selectable bundle item cannot define fixed_variant_id.`
        )
      }
    }

    return new StepResponse(void 0)
  }
)
