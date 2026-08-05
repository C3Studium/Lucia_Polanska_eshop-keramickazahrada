import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  revenueForProducts,
  statsByCode,
  type OrderScanRow,
} from "../../../../lib/sale-stats"
import { MERCHANT_CATALOG_MODULE } from "../../../../modules/merchant-catalog"

/**
 * Slevy+ — the joined read for the last missing domain (phase 3).
 *
 * Promotions, campaigns and price lists in one response, each row carrying
 * what its native page makes you open three screens for: a promotion knows
 * its campaign, its rules in words, and how often it was really used; a
 * campaign knows its budget spent against limit and how many promotions it
 * carries; a price list knows how many prices it holds and when its window
 * runs.
 *
 * **Read-only by design.** Every write from Slevy+ goes to the native admin
 * APIs (`/admin/promotions`, `/admin/campaigns`, `/admin/price-lists`) so
 * exactly one system owns a price or a code — this endpoint only refuses to
 * make her open three pages to see one picture.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const catalog = req.scope.resolve<any>(MERCHANT_CATALOG_MODULE)

  const [{ data: promotions }, { data: campaigns }, { data: priceLists }, selections] =
    await Promise.all([
      query.graph({
        entity: "promotion",
        fields: [
          "id",
          "code",
          "status",
          "is_automatic",
          "created_at",
          "campaign.id",
          "campaign.name",
          "application_method.type",
          "application_method.value",
          "application_method.target_type",
          "application_method.currency_code",
        ],
        pagination: { take: 200, skip: 0 },
      }),
      query.graph({
        entity: "campaign",
        fields: [
          "id",
          "name",
          "description",
          "starts_at",
          "ends_at",
          "budget.type",
          "budget.limit",
          "budget.used",
          "promotions.id",
        ],
        pagination: { take: 100, skip: 0 },
      }).catch(() => ({ data: [] as any[] })),
      query.graph({
        entity: "price_list",
        fields: [
          "id",
          "title",
          "description",
          "status",
          "starts_at",
          "ends_at",
          "prices.id",
        ],
        pagination: { take: 100, skip: 0 },
      }).catch(() => ({ data: [] as any[] })),
      (catalog
        .listSeasonalSelections({} as never, { relations: ["items"] })
        .catch(() => [])) as Promise<any[]>,
    ])

  // One order scan feeds every statistic below — per-code revenue, campaign
  // roll-ups, seasonal windows. Capped and reported, never silently cut.
  let scan: OrderScanRow[] = []
  try {
    const { data: scannedOrders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "created_at",
        "total",
        "items.product_id",
        "items.total",
        "items.adjustments.code",
        "items.adjustments.amount",
      ],
      pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
    })
    scan = (scannedOrders as any[]).map((order) => ({
      id: order.id,
      created_at: String(order.created_at),
      total: Number(order.total) || 0,
      items: (order.items ?? []).map((item: any) => ({
        product_id: item?.product_id ?? null,
        total: Number(item?.total) || 0,
        adjustments: (item?.adjustments ?? []).map((adjustment: any) => ({
          code: adjustment?.code ?? null,
          amount: Number(adjustment?.amount) || 0,
        })),
      })),
    }))
  } catch {
    // Statistics are decoration; the lists must not die for them.
  }

  const codeStats = statsByCode(scan)

  const describeMethod = (method: any): string | null => {
    if (!method) return null
    const value = Number(method.value) || 0
    const amount =
      method.type === "percentage"
        ? `${value} %`
        : `${value} ${String(method.currency_code || "czk").toUpperCase()}`
    const target =
      method.target_type === "shipping_methods" ? "na dopravu" : "na zboží"
    return `−${amount} ${target}`
  }

  res.status(200).json({
    promotions: (promotions as any[]).map((promotion) => ({
      id: promotion.id,
      code: promotion.code,
      is_automatic: Boolean(promotion.is_automatic),
      status: promotion.status,
      effect: describeMethod(promotion.application_method),
      campaign: promotion.campaign
        ? { id: promotion.campaign.id, name: promotion.campaign.name }
        : null,
      used_count: promotion.code
        ? (codeStats.get(String(promotion.code))?.orders ?? 0)
        : null,
      revenue: promotion.code
        ? (codeStats.get(String(promotion.code))?.revenue ?? 0)
        : null,
      discount_given: promotion.code
        ? (codeStats.get(String(promotion.code))?.discount_given ?? 0)
        : null,
      created_at: promotion.created_at,
    })),
    campaigns: (campaigns as any[]).map((campaign) => {
      // Roll-up of the campaign's member codes. Orders are summed per code;
      // a basket using two codes of one campaign counts once per code — the
      // same rule as the per-code rows, stated here so nobody "fixes" it
      // into inconsistency.
      const memberCodes = (promotions as any[])
        .filter((promotion) => promotion.campaign?.id === campaign.id)
        .map((promotion) => promotion.code)
        .filter(Boolean)
      let revenue = 0
      let discountGiven = 0
      let usedOrders = 0
      for (const code of memberCodes) {
        const entry = codeStats.get(String(code))
        if (entry) {
          revenue = Math.round((revenue + entry.revenue) * 100) / 100
          discountGiven =
            Math.round((discountGiven + entry.discount_given) * 100) / 100
          usedOrders += entry.orders
        }
      }
      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description ?? null,
        starts_at: campaign.starts_at,
        ends_at: campaign.ends_at,
        budget: campaign.budget
          ? {
              type: campaign.budget.type,
              limit: campaign.budget.limit,
              used: campaign.budget.used,
            }
          : null,
        promotions_count: (campaign.promotions ?? []).length,
        used_orders: usedOrders,
        revenue,
        discount_given: discountGiven,
      }
    }),
    seasonal_selections: (selections as any[]).map((selection) => {
      const productIds = new Set<string>(
        (selection.items ?? [])
          .map((item: any) => item.product_id)
          .filter(Boolean)
      )
      const window = revenueForProducts(
        scan,
        productIds,
        selection.starts_at ? String(selection.starts_at) : null,
        selection.ends_at ? String(selection.ends_at) : null
      )
      return {
        id: selection.id,
        title: selection.title,
        status: selection.publication_status,
        starts_at: selection.starts_at,
        ends_at: selection.ends_at,
        products_count: productIds.size,
        orders: window.orders,
        revenue: window.units_revenue,
      }
    }),
    orders_scanned: scan.length,
    price_lists: (priceLists as any[]).map((list) => ({
      id: list.id,
      title: list.title,
      description: list.description ?? null,
      status: list.status,
      starts_at: list.starts_at,
      ends_at: list.ends_at,
      prices_count: (list.prices ?? []).length,
    })),
  })
}
