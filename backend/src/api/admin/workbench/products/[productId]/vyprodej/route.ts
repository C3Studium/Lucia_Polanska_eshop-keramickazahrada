import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { vyprodejBlockReason } from "../../../../../../lib/vyprodej-config"
import { vyprodejForProduct } from "../../../../../../lib/vyprodej"

/** Detail výrobku → řádek „Výprodej": ve kterém je, přes co, a jestli do něj smí. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [vyprodej, { data }] = await Promise.all([
    vyprodejForProduct(req.scope, req.params.productId),
    query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: req.params.productId } }),
  ])
  res.status(200).json({
    vyprodej: vyprodej
      ? {
          id: vyprodej.id,
          title: vyprodej.title,
          state: vyprodej.state,
          status: vyprodej.status,
          type: vyprodej.config.type,
          percent: vyprodej.config.percent,
          starts_at: vyprodej.starts_at,
          ends_at: vyprodej.ends_at,
          via: vyprodej.via,
        }
      : null,
    blocked: vyprodejBlockReason((data as any[])[0]?.metadata ?? null),
  })
}
