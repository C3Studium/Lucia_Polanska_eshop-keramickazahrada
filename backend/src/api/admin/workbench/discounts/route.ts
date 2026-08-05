import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

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

  const [{ data: promotions }, { data: campaigns }, { data: priceLists }] =
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
    ])

  // Real usage per code: orders whose adjustments carry it. The same count
  // the Slevy overview shows, computed the same way.
  const usageByCode = new Map<string, number>()
  try {
    const { data: adjustedOrders } = await query.graph({
      entity: "order",
      fields: ["id", "items.adjustments.code"],
      pagination: { take: 1000, skip: 0 },
    })
    for (const order of adjustedOrders as any[]) {
      const codes = new Set<string>()
      for (const item of order.items ?? []) {
        for (const adjustment of item?.adjustments ?? []) {
          if (adjustment?.code) codes.add(String(adjustment.code))
        }
      }
      for (const code of codes) {
        usageByCode.set(code, (usageByCode.get(code) ?? 0) + 1)
      }
    }
  } catch {
    // Usage is decoration; the list must not die for it.
  }

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
        ? (usageByCode.get(String(promotion.code)) ?? 0)
        : null,
      created_at: promotion.created_at,
    })),
    campaigns: (campaigns as any[]).map((campaign) => ({
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
    })),
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
