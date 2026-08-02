import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

type VariantProfileInput = {
  variant_id: string
  deposit_percentage_override?: number | null
  production_time_min_days_override?: number | null
  production_time_max_days_override?: number | null
}

type ProfileInput = {
  enabled?: boolean
  specification_required?: boolean
  specification_prompt?: string | null
  production_time_min_days?: number
  production_time_max_days?: number
  default_deposit_percentage?: number
  contact_customer_after_order?: boolean
  allow_final_price_adjustment?: boolean
  variants?: VariantProfileInput[]
}

const validateProfile = (input: ProfileInput) => {
  const deposit = input.default_deposit_percentage
  if (deposit !== undefined && (!Number.isFinite(deposit) || deposit < 1 || deposit > 100)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Výše zálohy musí být mezi 1 a 100 %."
    )
  }
  const min = input.production_time_min_days
  const max = input.production_time_max_days
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Minimální doba výroby není platná.")
  }
  if (max !== undefined && (!Number.isInteger(max) || max < 0)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Maximální doba výroby není platná.")
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Minimální doba výroby nesmí být delší než maximální."
    )
  }
  for (const variant of input.variants || []) {
    const override = variant.deposit_percentage_override
    if (override != null && (!Number.isFinite(override) || override < 1 || override > 100)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Záloha u provedení musí být mezi 1 a 100 %."
      )
    }
  }
}

const loadProfile = async (req: MedusaRequest) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productId = req.params.productId
  const [profiles, variantsResult, productResult] = await Promise.all([
    service.listProductProductionProfiles({ product_id: productId }),
    service.listVariantProductionProfiles({}),
    query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "thumbnail", "status", "variants.*"],
      filters: { id: productId },
    }),
  ])
  const product = productResult.data[0]
  const variantIds = new Set((product?.variants || []).map((variant: any) => variant.id))

  return {
    profile: profiles[0] || null,
    variants: variantsResult.filter((profile: any) => variantIds.has(profile.variant_id)),
    product: product || null,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const result = await loadProfile(req)
  res.status(200).json({ product: result })
}

export const PATCH = async (
  req: MedusaRequest<ProfileInput>,
  res: MedusaResponse
) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const productId = req.params.productId
  const input = req.body || {}
  validateProfile(input)

  const existing = await service.listProductProductionProfiles({ product_id: productId })
  const profilePayload = {
    enabled: input.enabled ?? true,
    specification_required: input.specification_required ?? true,
    specification_prompt: input.specification_prompt?.trim() || null,
    production_time_min_days: input.production_time_min_days ?? 14,
    production_time_max_days: input.production_time_max_days ?? 42,
    default_deposit_percentage: input.default_deposit_percentage ?? 25,
    contact_customer_after_order: input.contact_customer_after_order ?? true,
    allow_final_price_adjustment: input.allow_final_price_adjustment ?? true,
  }
  const profile = existing[0]
    ? await service.updateProductProductionProfiles({
        id: existing[0].id,
        ...profilePayload,
      })
    : await service.createProductProductionProfiles({
        product_id: productId,
        ...profilePayload,
      })

  if (Array.isArray(input.variants)) {
    for (const variantInput of input.variants) {
      const current = await service.listVariantProductionProfiles({
        variant_id: variantInput.variant_id,
      })
      const payload = {
        deposit_percentage_override:
          variantInput.deposit_percentage_override ?? null,
        production_time_min_days_override:
          variantInput.production_time_min_days_override ?? null,
        production_time_max_days_override:
          variantInput.production_time_max_days_override ?? null,
      }
      if (current[0]) {
        await service.updateVariantProductionProfiles({ id: current[0].id, ...payload })
      } else {
        await service.createVariantProductionProfiles({
          variant_id: variantInput.variant_id,
          ...payload,
        })
      }
    }
  }

  const result = await loadProfile(req)
  res.status(200).json({ product: { ...result, profile } })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const existing = await service.listProductProductionProfiles({
    product_id: req.params.productId,
  })
  if (existing[0]) {
    await service.deleteProductProductionProfiles(existing[0].id)
  }
  res.status(200).json({ id: req.params.productId, deleted: Boolean(existing[0]) })
}

