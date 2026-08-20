import { MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"

addToCartWorkflow.hooks.validate(
  async ({ input }, { container }) => {
    const query = container.resolve("query")
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["product.*"],
      filters: {
        id: input.items.map((item) => item.variant_id).filter(Boolean) as string[],
      },
    })
    for (const item of input.items) {
      const variant = variants.find((v) => v.id === item.variant_id)
      if (!variant?.product?.metadata?.is_personalized) {
        continue
      }
      const height = Number(item.metadata?.height)
      const width = Number(item.metadata?.width)
      // Same bounds as the price route — the price is derived from these
      // numbers, so a negative or absurd dimension is a self-served discount.
      if (
        !Number.isFinite(height) || !Number.isFinite(width) ||
        height <= 0 || width <= 0 || height > 300 || width > 300
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Zadejte prosím výšku a šířku v centimetrech (1–300)."
        )
      }
    }
  }
)