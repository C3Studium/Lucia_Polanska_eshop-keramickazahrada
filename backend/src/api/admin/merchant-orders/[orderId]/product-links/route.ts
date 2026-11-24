import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { productLink } from "../../../../../lib/storefront-url"

/**
 * Odkazy na výrobky z řádků objednávky (24. 11. 2026, Lucie: „aby název
 * produktu v objednávce byl aktivní — hodil mě na ten produkt do e-shopu").
 *
 * Admin běží v prohlížeči a adresu obchodu nezná (je v proměnných backendu,
 * `lib/storefront-url`), proto ji řádkům Souhrnu dává tahle cesta:
 * `store_url` = stránka výrobku v e-shopu (jen zveřejněný výrobek — skrytý
 * by v obchodě skončil na 404), `product_id` pro tlačítko „Upravit výrobek".
 * Řádky bez výrobku (balné, doběrečné) odkaz nedostanou.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.id", "items.title", "items.product_id"],
    filters: { id: req.params.orderId },
  })
  const items = ((orders[0] as any)?.items ?? []) as Array<{
    id: string
    title?: string | null
    product_id?: string | null
  }>

  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))] as string[]
  const products = productIds.length
    ? ((
        await query.graph({
          entity: "product",
          fields: ["id", "handle", "status"],
          filters: { id: productIds },
        })
      ).data as Array<{ id: string; handle?: string | null; status?: string | null }>)
    : []
  const byId = new Map(products.map((product) => [product.id, product]))

  res.json({
    items: items.map((item) => {
      const product = item.product_id ? byId.get(item.product_id) : undefined
      return {
        id: item.id,
        title: item.title ?? "",
        product_id: product ? product.id : null,
        store_url:
          product && product.status === "published" ? productLink(product.handle) || null : null,
      }
    }),
  })
}
