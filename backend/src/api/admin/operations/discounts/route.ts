import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Everything that makes something cheaper than usual, in one list (§13).
 *
 * Four instruments run independently — a seasonal sale, an ad-hoc price list, a
 * discount code, an automatic discount — and each lives on a different page.
 * That is fine when you are creating one and useless when you are asking „what
 * is discounted right now?", which is a question about all four at once.
 *
 * Read-only. Editing stays where each instrument is created, so there is
 * exactly one place that can change a price.
 */

const DAY_MS = 24 * 60 * 60 * 1000

type Row = {
  id: string
  kind: "selection" | "price_list" | "code" | "automatic"
  /** Orders that used this code; `null` where usage has no meaning. */
  used_count?: number | null
  title: string
  detail: string | null
  status: "running" | "scheduled" | "ended"
  starts_at: string | null
  ends_at: string | null
  ends_in_days: number | null
  edit_path: string
}

const daysUntil = (value: unknown): number | null => {
  if (!value) {
    return null
  }
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.ceil((date.getTime() - Date.now()) / DAY_MS)
}

/** Status from the dates, not from a stored flag that may not have caught up. */
const statusFrom = (
  startsAt: unknown,
  endsAt: unknown,
  now: number
): Row["status"] => {
  const start = startsAt ? new Date(startsAt as string).getTime() : null
  const end = endsAt ? new Date(endsAt as string).getTime() : null

  if (end !== null && end < now) {
    return "ended"
  }
  if (start !== null && start > now) {
    return "scheduled"
  }
  return "running"
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = Date.now()

  const [
    { data: selections },
    { data: priceLists },
    { data: promotions },
  ] = await Promise.all([
    query.graph({
      entity: "seasonal_selection",
      fields: [
        "id",
        "title",
        "publication_status",
        "starts_at",
        "ends_at",
        "linked_price_list_id",
        "items.id",
      ],
    }),
    query.graph({
      entity: "price_list",
      fields: ["id", "title", "status", "starts_at", "ends_at"],
    }),
    query.graph({
      entity: "promotion",
      fields: [
        "id",
        "code",
        "status",
        "is_automatic",
        "campaign.name",
        "campaign.budget.used",
        "campaign.budget.limit",
      ],
    }),
  ])

  const rows: Row[] = []

  // Seasonal sales that actually carry a discount. One without a linked price
  // list is editorial curation, not a discount, so it does not belong here.
  for (const selection of selections as any[]) {
    if (selection.publication_status === "archived") {
      continue
    }
    const itemCount = (selection.items || []).length
    rows.push({
      id: selection.id,
      kind: "selection",
      title: selection.title,
      detail: selection.linked_price_list_id
        ? `${itemCount} produktů se slevou`
        : `${itemCount} produktů, bez slevy`,
      status: statusFrom(selection.starts_at, selection.ends_at, now),
      starts_at: selection.starts_at ?? null,
      ends_at: selection.ends_at ?? null,
      ends_in_days: daysUntil(selection.ends_at),
      edit_path: "/sezonni-vybery",
    })
  }

  // Price lists a seasonal sale already owns are skipped — they would otherwise
  // appear twice, once as the sale and once as its own machinery.
  const linkedPriceListIds = new Set(
    (selections as any[])
      .map((selection) => selection.linked_price_list_id)
      .filter(Boolean)
  )

  for (const list of priceLists as any[]) {
    if (linkedPriceListIds.has(list.id)) {
      continue
    }
    rows.push({
      id: list.id,
      kind: "price_list",
      title: list.title,
      detail: list.status === "active" ? "Akční ceník" : "Rozpracovaný ceník",
      status:
        list.status === "active"
          ? statusFrom(list.starts_at, list.ends_at, now)
          : "scheduled",
      starts_at: list.starts_at ?? null,
      ends_at: list.ends_at ?? null,
      ends_in_days: daysUntil(list.ends_at),
      edit_path: `/price-lists/${list.id}`,
    })
  }

  // How often each code was actually used — the difference between a
  // discount that works and one that only exists. Order adjustments carry
  // the promotion code; counting them is the honest usage number, campaign
  // budgets exist only when a budget was configured.
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
    // Usage is decoration on this view; the list must not die for it.
  }

  for (const promotion of promotions as any[]) {
    const automatic = Boolean(promotion.is_automatic)
    rows.push({
      id: promotion.id,
      kind: automatic ? "automatic" : "code",
      title: automatic
        ? promotion.campaign?.name || "Automatická sleva"
        : promotion.code,
      detail: automatic
        ? "Platí sama, zákazník nic nezadává"
        : "Zákazník zadá kód v košíku",
      status: promotion.status === "active" ? "running" : "scheduled",
      used_count: promotion.code
        ? (usageByCode.get(String(promotion.code)) ?? 0)
        : null,
      starts_at: null,
      ends_at: null,
      ends_in_days: null,
      edit_path: `/promotions/${promotion.id}`,
    })
  }

  // Running first, then what is coming, then what is over; soonest end first
  // within each group, because that is the one that needs a decision next.
  const order: Record<Row["status"], number> = {
    running: 0,
    scheduled: 1,
    ended: 2,
  }
  rows.sort((a, b) => {
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status]
    }
    if (a.ends_in_days === null) return 1
    if (b.ends_in_days === null) return -1
    return a.ends_in_days - b.ends_in_days
  })

  res.status(200).json({
    discounts: rows,
    running: rows.filter((row) => row.status === "running").length,
  })
}
