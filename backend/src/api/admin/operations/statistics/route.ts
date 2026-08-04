import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Business insight over a period — orders, takings, best sellers, abandoned
 * carts.
 *
 * This is deliberately **not** on the Přehled dashboard. §4 makes that screen
 * answer „co mám udělat teď?", and a best-seller ranking over a year is not
 * something anybody acts on this morning; putting it next to „3 objednávky k
 * zabalení" would make the urgent compete with the interesting. It lives behind
 * its own tab, where looking at it is a deliberate act.
 *
 * Everything is computed on demand from native order and cart records. Nothing
 * is stored, so there is no aggregate that can drift out of sync with the
 * orders it claims to summarise.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** The windows the merchant asked for. `all` means no lower bound. */
const PERIODS: Record<string, number | null> = {
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  all: null,
}

/** Payment states in which money actually arrived. */
const PAID_STATUSES = ["captured", "partially_captured"]

/** One page of the scan. */
const PAGE_SIZE = 200

/**
 * Ceiling on a single request. A shop this size will never reach it, but „all"
 * grows forever and an unbounded scan is a request that gets slower every
 * month until it times out. When it trips, the response says so rather than
 * quietly reporting a partial total as if it were complete.
 */
const MAX_ORDERS = 5_000
const MAX_CARTS = 20_000

const ORDER_FIELDS = [
  "id",
  "created_at",
  "currency_code",
  // `total` is derived from the item projection — without `items.*` every
  // order reads as zero.
  "total",
  "items.*",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
]

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

type ProductTally = {
  product_id: string
  title: string
  thumbnail: string | null
  quantity: number
  revenue: number
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const requested = String(req.query.period ?? "30d")
  const period = requested in PERIODS ? requested : "30d"
  const days = PERIODS[period]
  const since = days === null ? null : new Date(Date.now() - days * DAY_MS)

  const dateFilter = since ? { created_at: { $gte: since } } : {}

  // ---- Orders --------------------------------------------------------------
  let orders: any[] = []
  let ordersTruncated = false
  let offset = 0

  for (;;) {
    const { result } = await getOrdersListWorkflow(req.scope).run({
      input: {
        fields: ORDER_FIELDS,
        variables: {
          filters: { is_draft_order: false, ...dateFilter },
          order: { created_at: "DESC" },
          skip: offset,
          take: PAGE_SIZE,
        },
      },
    })
    const page = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
    orders.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }
    offset += PAGE_SIZE
    if (orders.length >= MAX_ORDERS) {
      ordersTruncated = true
      break
    }
  }

  const paidOrders = orders.filter((order) =>
    PAID_STATUSES.includes(order.payment_status)
  )
  const revenue = paidOrders.reduce(
    (sum, order) => sum + toNumber(order.total),
    0
  )
  const currencyCode = String(
    orders[0]?.currency_code || "czk"
  ).toUpperCase()

  // ---- Best sellers --------------------------------------------------------
  // Counted from paid orders only: a piece that was ordered and never paid for
  // was never sold, and letting it rank would make the list advise badly.
  const tallies = new Map<string, ProductTally>()

  for (const order of paidOrders) {
    for (const item of (order.items || []) as any[]) {
      const productId = item?.product_id
      if (!productId) {
        continue
      }
      const quantity = toNumber(item.quantity)
      const existing = tallies.get(productId)

      if (existing) {
        existing.quantity += quantity
        existing.revenue += quantity * toNumber(item.unit_price)
      } else {
        tallies.set(productId, {
          product_id: productId,
          title: item.title ?? "Produkt",
          thumbnail: item.thumbnail ?? null,
          quantity,
          revenue: quantity * toNumber(item.unit_price),
        })
      }
    }
  }

  const topProducts = [...tallies.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10)

  // ---- Carts ---------------------------------------------------------------
  // „Started but never finished" is the question, so carts with no items are
  // excluded — an empty cart is a page view, not an abandoned purchase.
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "items.id"],
    filters: dateFilter,
    pagination: { take: MAX_CARTS, skip: 0 },
  })

  const cartsWithItems = (carts as any[]).filter(
    (cart) => (cart.items || []).length > 0
  )
  const completedCarts = cartsWithItems.filter((cart) => cart.completed_at)
  const abandonedCarts = cartsWithItems.length - completedCarts.length

  res.status(200).json({
    period,
    since: since ? since.toISOString() : null,
    generated_at: new Date().toISOString(),
    truncated: ordersTruncated || (carts as any[]).length >= MAX_CARTS,
    orders: {
      count: orders.length,
      paid_count: paidOrders.length,
      revenue,
      currency_code: currencyCode,
      average_order_value: paidOrders.length
        ? revenue / paidOrders.length
        : 0,
    },
    carts: {
      started: cartsWithItems.length,
      completed: completedCarts.length,
      abandoned: abandonedCarts,
      abandonment_rate: cartsWithItems.length
        ? abandonedCarts / cartsWithItems.length
        : 0,
    },
    top_products: topProducts,
  })
}
