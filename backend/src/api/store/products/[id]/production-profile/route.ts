import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.params.id
  const [profiles, productResult] = await Promise.all([
    service.listProductProductionProfiles({ product_id: productId }),
    query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { id: productId },
    }),
  ])
  const profile = profiles[0]
  if (!profile?.enabled) {
    return res.status(200).json({ production_profile: null })
  }
  const variantIds = (productResult.data[0]?.variants || []).map(
    (variant: any) => variant.id
  )
  const variantProfiles = variantIds.length
    ? await service.listVariantProductionProfiles({ variant_id: variantIds })
    : []

  res.status(200).json({
    production_profile: {
      enabled: true,
      specification_required: profile.specification_required,
      specification_prompt: profile.specification_prompt,
      production_time_min_days: profile.production_time_min_days,
      production_time_max_days: profile.production_time_max_days,
      default_deposit_percentage: profile.default_deposit_percentage,
      contact_customer_after_order: profile.contact_customer_after_order,
      variants: variantProfiles.map((variant: any) => ({
        variant_id: variant.variant_id,
        deposit_percentage_override: variant.deposit_percentage_override,
        production_time_min_days_override:
          variant.production_time_min_days_override,
        production_time_max_days_override:
          variant.production_time_max_days_override,
      })),
    },
  })
}

