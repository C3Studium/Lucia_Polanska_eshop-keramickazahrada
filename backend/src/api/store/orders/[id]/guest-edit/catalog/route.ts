import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildEditCatalog } from "../../../../../../lib/order-edit/core"
import { loadOrderByToken } from "../../../../../../lib/order-edit/token"

/**
 * Mini obchod úpravy objednávky (docs/uprava-objednavky-plan.md §3c.2, §5):
 * které produkty a varianty jde do objednávky přidat. Storefront si produkty
 * načte běžným výpisem a ukáže jen tyhle; při uložení soudí server znovu.
 * `?swap=<item_id>` = náhrada za konkrétní řádek (§3d.10).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const order = await loadOrderByToken(req, req.query.token)
  const swap = typeof req.query.swap === "string" && req.query.swap ? req.query.swap : null
  res.status(200).json(await buildEditCatalog(req.scope, order, { swapItemId: swap }))
}
