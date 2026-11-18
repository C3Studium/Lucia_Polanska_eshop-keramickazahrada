import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { basePrices, listProductSales } from "../../../../lib/product-sale"

/**
 * Slevy → „Zlevněné výrobky" (18. 11. 2026): všechny výrobky se slevou
 * nastavenou přímo u ceny. Jen čte; zapíná, vypíná a mění se to na detailu
 * výrobku nebo z „…" v řádku (`/admin/workbench/products/:id/sale`).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sales = await listProductSales(req.scope)
  if (!sales.length) {
    res.status(200).json({ sales: [] })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "thumbnail",
      "status",
      "variants.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
      "variants.prices.rules_count",
    ],
    filters: { id: [...new Set(sales.map((sale) => sale.product_id))] },
  })
  const byId = new Map((products as any[]).map((product) => [product.id, product]))

  const order = { running: 0, scheduled: 1, off: 2, ended: 3 } as const

  const rows = sales
    .filter((sale) => byId.has(sale.product_id))
    .map((sale) => {
      const product = byId.get(sale.product_id)
      const czk = (product.variants ?? [])
        .flatMap((variant: any) => basePrices(variant))
        .filter((price: any) => price.currency_code === "czk" && price.amount > 0)
        .map((price: any) => price.amount)
      const before = czk.length ? Math.min(...czk) : null
      return {
        ...sale,
        title: product.title,
        thumbnail: product.thumbnail ?? null,
        product_status: product.status,
        price_before: before,
        price_after:
          before === null ? null : Math.max(1, Math.round((before * (100 - sale.percent)) / 100)),
        variants_count: (product.variants ?? []).length,
      }
    })
    .sort(
      (a, b) =>
        order[a.state] - order[b.state] || String(a.title).localeCompare(String(b.title), "cs")
    )

  res.status(200).json({ sales: rows })
}
