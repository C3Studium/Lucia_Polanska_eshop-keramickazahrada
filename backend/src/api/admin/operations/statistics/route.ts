import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Business insight over a period — orders, takings, best sellers, abandoned
 * carts.
 *
 * Od 17. 11. 2026 je tohle srdce Přehledu (přání majitelky: „skutečný
 * přehled — tržby, jak se dařilo, kolik lidí nakupovalo"). Přibyla časová
 * řada pro graf a srovnání s předchozím stejně dlouhým obdobím.
 *
 * Původně záměrně mimo Přehled: §4 makes that screen
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
  "7d": 7,
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
  "email",
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
  const now = Date.now()
  const since = days === null ? null : new Date(now - days * DAY_MS)
  // Srovnání: stejně dlouhé období těsně před tím. Načte se jedním dotazem
  // (dvojnásobné okno) a rozdělí se až tady.
  const previousSince = days === null ? null : new Date(now - 2 * days * DAY_MS)

  const fetchFrom = previousSince ?? since
  const dateFilter = fetchFrom ? { created_at: { $gte: fetchFrom } } : {}

  // ---- Orders --------------------------------------------------------------
  const allOrders: any[] = []
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
    allOrders.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }
    offset += PAGE_SIZE
    if (allOrders.length >= MAX_ORDERS) {
      ordersTruncated = true
      break
    }
  }

  const inCurrent = (value: unknown) =>
    !since || new Date(value as string).getTime() >= since.getTime()
  const orders = allOrders.filter((order) => inCurrent(order.created_at))
  const previousOrders = allOrders.filter((order) => !inCurrent(order.created_at))

  const isPaid = (order: any) => PAID_STATUSES.includes(order.payment_status)
  const paidOrders = orders.filter(isPaid)
  const previousPaid = previousOrders.filter(isPaid)
  const sumRevenue = (list: any[]) =>
    list.reduce((sum, order) => sum + toNumber(order.total), 0)
  const revenue = sumRevenue(paidOrders)
  const currencyCode = String(orders[0]?.currency_code || "czk").toUpperCase()
  // Kolik různých lidí nakoupilo (podle e-mailu) — „kolik lidí obchod použilo".
  const buyersOf = (list: any[]) =>
    new Set(
      list.map((order) => String(order.email ?? "").toLowerCase()).filter(Boolean)
    ).size

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

  // ---- Time series ---------------------------------------------------------
  const series = buildSeries(paidOrders, orders, period, since, now)

  // ---- Carts ---------------------------------------------------------------
  // „Started but never finished" is the question, so carts with no items are
  // excluded — an empty cart is a page view, not an abandoned purchase.
  const { data: allCarts } = await query.graph({
    entity: "cart",
    fields: ["id", "created_at", "completed_at", "items.id"],
    filters: dateFilter,
    pagination: { take: MAX_CARTS, skip: 0 },
  })

  const withItems = (allCarts as any[]).filter((cart) => (cart.items || []).length > 0)
  const cartsWithItems = withItems.filter((cart) => inCurrent(cart.created_at))
  const previousCarts = withItems.filter((cart) => !inCurrent(cart.created_at))
  const completedCarts = cartsWithItems.filter((cart) => cart.completed_at)
  const abandonedCarts = cartsWithItems.length - completedCarts.length

  res.status(200).json({
    period,
    since: since ? since.toISOString() : null,
    generated_at: new Date().toISOString(),
    truncated: ordersTruncated || (allCarts as any[]).length >= MAX_CARTS,
    orders: {
      count: orders.length,
      paid_count: paidOrders.length,
      revenue,
      currency_code: currencyCode,
      average_order_value: paidOrders.length ? revenue / paidOrders.length : 0,
      buyers: buyersOf(paidOrders),
    },
    carts: {
      started: cartsWithItems.length,
      completed: completedCarts.length,
      abandoned: abandonedCarts,
      abandonment_rate: cartsWithItems.length ? abandonedCarts / cartsWithItems.length : 0,
    },
    // Stejná čísla za předchozí stejně dlouhé období (u „vše" null).
    previous:
      days === null
        ? null
        : {
            count: previousOrders.length,
            paid_count: previousPaid.length,
            revenue: sumRevenue(previousPaid),
            average_order_value: previousPaid.length
              ? sumRevenue(previousPaid) / previousPaid.length
              : 0,
            buyers: buyersOf(previousPaid),
            carts_started: previousCarts.length,
          },
    series,
    top_products: topProducts,
  })
}

export type SeriesPoint = {
  key: string
  /** Krátký popisek pod sloupcem: „17. 11.", „lis". */
  label: string
  start: string
  revenue: number
  orders: number
}

const MONTHS = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"]

/** Den v UTC — pro graf po dnech stačí (server běží v UTC). */
const startOfDay = (time: number) => {
  const d = new Date(time)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Časová řada pro graf na Přehledu: krátká období po dnech, čtvrtletí po
 * týdnech, delší po měsících. Prázdné dny/měsíce jsou v řadě taky (nula),
 * jinak by graf lhal o tempu.
 */
export const buildSeries = (
  paidOrders: any[],
  allOrders: any[],
  period: string,
  since: Date | null,
  now: number
): SeriesPoint[] => {
  const unit: "day" | "week" | "month" =
    period === "7d" || period === "30d" ? "day" : period === "3m" ? "week" : "month"

  const firstOrder = allOrders.reduce(
    (min, order) => Math.min(min, new Date(order.created_at).getTime()),
    now
  )
  const from = startOfDay(since ? since.getTime() : firstOrder)

  const keyOf = (time: number): string => {
    const d = new Date(time)
    if (unit === "month") return `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    if (unit === "week") return String(Math.floor((startOfDay(time) - from) / (7 * DAY_MS)))
    return String(startOfDay(time))
  }

  const buckets: SeriesPoint[] = []
  if (unit === "month") {
    const first = new Date(from)
    let year = first.getUTCFullYear()
    let month = first.getUTCMonth()
    const end = new Date(now)
    while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
      buckets.push({
        key: `${year}-${month}`,
        label: MONTHS[month],
        start: new Date(Date.UTC(year, month, 1)).toISOString(),
        revenue: 0,
        orders: 0,
      })
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
    }
  } else {
    const step = unit === "week" ? 7 * DAY_MS : DAY_MS
    for (let time = from, index = 0; time <= now; time += step, index += 1) {
      const d = new Date(time)
      buckets.push({
        key: unit === "week" ? String(index) : String(time),
        label: `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`,
        start: d.toISOString(),
        revenue: 0,
        orders: 0,
      })
    }
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const order of allOrders) {
    const bucket = byKey.get(keyOf(new Date(order.created_at).getTime()))
    if (bucket) bucket.orders += 1
  }
  for (const order of paidOrders) {
    const bucket = byKey.get(keyOf(new Date(order.created_at).getTime()))
    if (bucket) bucket.revenue += toNumber(order.total)
  }
  return buckets
}
