import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import MadeToOrderModuleService from "../../../../modules/made-to-order/service"

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const [profiles, count] = await service.listAndCountProductProductionProfiles(
    {},
    { take: limit, skip: offset, order: { created_at: "DESC" } }
  )
  const productIds = profiles.map((profile: any) => profile.product_id)
  const { data: products } = productIds.length
    ? await query.graph({
        entity: "product",
        fields: ["id", "title", "handle", "thumbnail", "status", "variants.*"],
        filters: { id: productIds },
      })
    : { data: [] }
  const byId = new Map(products.map((product: any) => [product.id, product]))

  res.status(200).json({
    products: profiles.map((profile: any) => ({
      ...profile,
      product: byId.get(profile.product_id) || null,
    })),
    count,
    limit,
    offset,
  })
}

