import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { jeVyresena, vyreseneKoreny } from "../../../../lib/email-retries"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { getInventoryAlerts } from "../../../../lib/inventory-alerts"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../modules/merchant-order/service"
import { MERCHANT_ORDER_STAGES } from "../../../../modules/merchant-order/stages"
import type { MerchantOrderStage } from "../../../../modules/merchant-order/stages"
import { toMerchantOrderRow } from "../../merchant-orders/projection"

/**
 * Everything Přehled needs, in one request (WorkflowPlan.md §4).
 *
 * The dashboard answers „co mám udělat teď?", which means it has to read across
 * orders, production, payments, stock, reviews and notifications at once. Doing
 * that from the browser would be eight round-trips and eight loading states, so
 * it is composed here instead — read-only, no writes, no stored aggregate.
 *
 * Nothing in this file computes commerce values by hand: order totals and
 * payment status come from `getOrdersListWorkflow`, stock from the shared
 * inventory rules, money on commissions from the module's own snapshots.
 */

/** Attention items are scoped to a window; otherwise they only ever grow. */
const ATTENTION_WINDOW_DAYS = 7

/** „Odesláno" and „Končí brzy" both work in days, so keep one converter. */
const DAY_MS = 24 * 60 * 60 * 1000

const daysSince = (value: unknown): number | null => {
  if (!value) {
    return null
  }
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return Math.floor((Date.now() - date.getTime()) / DAY_MS)
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return value
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

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  // `items.*` is what makes `total` correct — the total is derived from the item
  // projection, so a narrower selection silently yields zero.
  "total",
  "items.*",
  "summary.*",
  "shipping_methods.*",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "fulfillments.id",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

/** The stages that still owe work, oldest first — §4's „Na řadě" ordering. */
const NEXT_UP_STAGES: MerchantOrderStage[] = [
  "payment_problem",
  "received",
  "shipping",
]

const NEXT_UP_LIMIT = 5

/**
 * Volby rozbalovačky „Na řadě" v Přehledu. Řadí a vybírá SERVER: klient má
 * jen pět řádků, takže „od nejnovější" by nad nimi vrátilo nejnovější z pěti
 * nejdéle čekajících — tedy nesmysl (3. 11. 2026).
 */
const NEXT_UP_SORTS = ["oldest", "newest"] as const
const NEXT_UP_ONLY = [
  "all",
  "commissions",
  "payment_problem",
  "received",
  "shipping",
] as const
type NextUpSort = (typeof NEXT_UP_SORTS)[number]
type NextUpOnly = (typeof NEXT_UP_ONLY)[number]

/**
 * Kolik řádků se smí projít, než se z nich vybere pět. „Jen zakázky" se pozná
 * až nad načtenými řádky (zakázka visí na jiné tabulce), takže se jich načte
 * víc a ořeže se to na konci.
 */
const NEXT_UP_SCAN = 60

/** Hodnota z dotazu, jen když je v seznamu — jinak výchozí. */
const volbaZDotazu = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback

const PRODUCTION_TERMINAL_STAGES = ["completed", "cancelled"]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const notifications = req.scope.resolve(Modules.NOTIFICATION)

  const now = new Date()
  const attentionSince = new Date(now.getTime() - ATTENTION_WINDOW_DAYS * DAY_MS)
  const endingSoonBefore = new Date(now.getTime() + 7 * DAY_MS)

  // ---- Queue stage counts (one indexed count per stage) ---------------------
  const stageCountEntries = await Promise.all(
    MERCHANT_ORDER_STAGES.map(async (stage) => {
      const [, count] = await merchantOrders.listAndCountMerchantOrderStates(
        { stage } as never,
        { take: 1 }
      )
      return [stage, count] as const
    })
  )
  const stageCounts = Object.fromEntries(stageCountEntries) as Record<
    MerchantOrderStage,
    number
  >

  // ---- Production ----------------------------------------------------------
  const productionOrders = await madeToOrder.listProductionOrders(
    {} as never,
    { relations: ["payment_requests"] }
  )

  const activeProduction = (productionOrders as any[]).filter(
    (production) => !PRODUCTION_TERMINAL_STAGES.includes(production.stage)
  )

  const overdueProduction = activeProduction.filter((production) => {
    if (!production.estimated_completion_at) {
      return false
    }
    return new Date(production.estimated_completion_at).getTime() < now.getTime()
  })

  const inProduction = activeProduction.filter(
    (production) => production.stage === "in_production"
  )
  const nearestDeadline = inProduction
    .map((production) => production.estimated_completion_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .sort((a, b) => a.getTime() - b.getTime())[0]

  const awaitingBalance = activeProduction.filter(
    (production) => production.stage === "awaiting_balance"
  )
  // Outstanding money comes from the request snapshots the module already keeps,
  // never from re-deriving what the customer owes.
  const outstandingRequests = awaitingBalance.flatMap((production) =>
    (production.payment_requests || []).filter(
      (request: any) =>
        request?.type === "balance" &&
        ["draft", "pending", "sent"].includes(request?.status)
    )
  )
  const outstandingAmount = outstandingRequests.reduce(
    (sum: number, request: any) => sum + toNumber(request.amount),
    0
  )
  const oldestBalanceRequestDays = awaitingBalance
    .map((production) => daysSince(production.balance_requested_at))
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0]

  // ---- Reviews, stock ------------------------------------------------------
  const [pendingReviewsResult, inventory] = await Promise.all([
    query.graph({
      entity: "review",
      fields: ["id"],
      filters: { status: "čeká na schválení" },
    }),
    getInventoryAlerts(req.scope),
  ])

  /*
   * ---- Nezdařené e-maily v okně ------------------------------------------
   *
   * Dřív tu stálo „a notification is never resolved" a počítalo se prostě
   * všechno se stavem `failure`. Jenže vyřešit se to dá: tlačítkem „Poslat
   * znovu", které vyrobí nový pokus ukazující na ten původní. Původní řádek
   * zůstává jako doklad, ale jako nedoručený e-mail se počítat nemá —
   * zákazník ho dostal. Stejné pravidlo jako v /admin/operations/emails.
   */
  const nezdareneVOkne = (await notifications.listNotifications(
    {
      channel: "email",
      status: "failure",
      created_at: { $gte: attentionSince },
    } as never,
    { take: 1000, select: ["id", "original_notification_id"] } as never
  )) as unknown as { id: string; original_notification_id?: string | null }[]

  // Úspěchy se neomezují oknem: opakované odeslání může přijít i o pár dní
  // později a pořád vyřešilo ten původní e-mail.
  const uspesneEmaily = (await notifications.listNotifications(
    { channel: "email", status: "success" } as never,
    { take: 1000, select: ["id", "original_notification_id"] } as never
  )) as unknown as { id: string; original_notification_id?: string | null }[]

  const vyreseneEmailoveKoreny = vyreseneKoreny(uspesneEmaily)
  const failedEmailCount = nezdareneVOkne.filter(
    (radek) => !jeVyresena(radek, vyreseneEmailoveKoreny)
  ).length

  // The ship-failure notification (#10, P3-5) tags itself through the dedupe
  // key's second segment, which the notify helper stores as `trigger_type`.
  const [, carrierFailureCount] = await notifications.listAndCountNotifications(
    {
      channel: "feed",
      trigger_type: ["shipfail", "carrier"],
      created_at: { $gte: attentionSince },
    } as never,
    { take: 1 }
  )

  // ---- Ending soon: native price lists + seasonal selections ---------------
  const [{ data: endingPriceLists }, { data: endingSelections }] =
    await Promise.all([
      query.graph({
        entity: "price_list",
        fields: ["id", "title", "ends_at", "status"],
        filters: {
          status: "active",
          ends_at: { $gte: now, $lte: endingSoonBefore },
        },
      }),
      query.graph({
        entity: "seasonal_selection",
        fields: ["id", "title", "ends_at", "publication_status"],
        filters: {
          publication_status: "published",
          ends_at: { $gte: now, $lte: endingSoonBefore },
        },
      }),
    ])

  // Active discounts, so she can see at a glance what is currently cheaper than
  // usual — three separate instruments (§13) that are easy to forget about
  // once they are running.
  const [{ data: activePriceLists }, { data: promotions }] = await Promise.all([
    query.graph({
      entity: "price_list",
      fields: ["id", "title", "status", "starts_at", "ends_at"],
      filters: { status: "active" },
    }),
    query.graph({
      entity: "promotion",
      fields: ["id", "code", "status", "is_automatic"],
      filters: { status: "active" },
    }),
  ])

  const activePromotions = promotions as any[]

  const endingSoon = [
    ...(endingPriceLists as any[]).map((list) => ({
      type: "price_list" as const,
      title: list.title as string,
      ends_at: list.ends_at,
    })),
    ...(endingSelections as any[]).map((selection) => ({
      type: "seasonal_selection" as const,
      title: selection.title as string,
      ends_at: selection.ends_at,
    })),
  ].sort(
    (a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
  )

  // ---- „Na řadě" — pět objednávek, které na někoho čekají -----------------
  // Výchozí pořadí je to, co tu bylo vždycky: nejdéle čekající, a potíže
  // s platbou napřed. Rozbalovačka v Přehledu umí přepnout na nejnovější
  // a omezit výběr (jen zakázky, jen nové, jen k odeslání…).
  const nextUpSort = volbaZDotazu<NextUpSort>(
    req.query.next_up_sort,
    NEXT_UP_SORTS,
    "oldest"
  )
  const nextUpOnly = volbaZDotazu<NextUpOnly>(
    req.query.next_up_only,
    NEXT_UP_ONLY,
    "all"
  )
  const commissionOrderIds = new Set(
    (productionOrders as any[]).map((production) => production.order_id)
  )
  const nextUpWantedStages: MerchantOrderStage[] =
    nextUpOnly === "all" || nextUpOnly === "commissions"
      ? NEXT_UP_STAGES
      : [nextUpOnly as MerchantOrderStage]
  const nextUpScan = nextUpOnly === "commissions" ? NEXT_UP_SCAN : NEXT_UP_LIMIT

  const scannedStates: any[] = []
  if (nextUpSort === "newest") {
    // Od nejnovější: čas vyhrává nad pořadím fází, takže jeden dotaz přes
    // všechny — jinak by se napřed vyčerpaly potíže s platbou.
    scannedStates.push(
      ...(await merchantOrders.listMerchantOrderStates(
        { stage: nextUpWantedStages } as never,
        { take: nextUpScan, order: { stage_changed_at: "DESC" } }
      ))
    )
  } else {
    for (const stage of nextUpWantedStages) {
      if (scannedStates.length >= nextUpScan) {
        break
      }
      const states = await merchantOrders.listMerchantOrderStates(
        { stage } as never,
        {
          take: nextUpScan - scannedStates.length,
          order: { stage_changed_at: "ASC" },
        }
      )
      scannedStates.push(...states)
    }
  }

  const nextUpStates = (
    nextUpOnly === "commissions"
      ? scannedStates.filter((state) => commissionOrderIds.has(state.order_id))
      : scannedStates
  ).slice(0, NEXT_UP_LIMIT)

  let nextUpOrders: any[] = []
  if (nextUpStates.length) {
    const { result } = await getOrdersListWorkflow(req.scope).run({
      input: {
        fields: ORDER_FIELDS,
        variables: {
          filters: { id: nextUpStates.map((state) => state.order_id) },
        },
      },
    })
    nextUpOrders = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
  }

  const orderById = new Map(nextUpOrders.map((order: any) => [order.id, order]))
  const productionByOrderId = new Map(
    (productionOrders as any[]).map((production) => [
      production.order_id,
      production,
    ])
  )

  // Order changes feed the A2 gate, so „Na řadě" blocks exactly what the
  // queues block.
  const { data: nextUpChanges } = nextUpStates.length
    ? await query.graph({
        entity: "order_change",
        fields: ["id", "order_id", "status"],
        filters: { order_id: nextUpStates.map((state) => state.order_id) },
      })
    : { data: [] as any[] }

  const changesByOrderId = new Map<string, any[]>()
  for (const change of nextUpChanges as any[]) {
    const existing = changesByOrderId.get(change.order_id) || []
    existing.push(change)
    changesByOrderId.set(change.order_id, existing)
  }

  const nextUp = nextUpStates.map((state) =>
    toMerchantOrderRow(
      state,
      orderById.get(state.order_id) || null,
      productionByOrderId.get(state.order_id) || null,
      changesByOrderId.get(state.order_id) || []
    )
  )

  // Age of the oldest order sitting in K odeslání — §4 warns above 3 days.
  const shippingStates = await merchantOrders.listMerchantOrderStates(
    { stage: "shipping" } as never,
    { take: 1, order: { stage_changed_at: "ASC" } }
  )

  res.status(200).json({
    generated_at: now.toISOString(),
    attention: {
      payment_problems: stageCounts.payment_problem ?? 0,
      failed_emails: failedEmailCount,
      carrier_failures: carrierFailureCount,
      overdue_production: overdueProduction.length,
      window_days: ATTENTION_WINDOW_DAYS,
    },
    today: {
      new_orders: stageCounts.received ?? 0,
      working: stageCounts.working ?? 0,
      shipping: stageCounts.shipping ?? 0,
      shipping_oldest_days: daysSince(shippingStates[0]?.stage_changed_at),
      awaiting_balance: {
        count: awaitingBalance.length,
        outstanding_amount: outstandingAmount,
        currency_code: String(
          awaitingBalance[0]?.currency_code || "czk"
        ).toLowerCase(),
        oldest_request_days: oldestBalanceRequestDays ?? null,
      },
      in_production: {
        count: inProduction.length,
        nearest_deadline: nearestDeadline ? nearestDeadline.toISOString() : null,
      },
    },
    shop: {
      low_stock: inventory.low.length,
      sold_out: inventory.out.length,
      low_stock_threshold: inventory.default_threshold,
      pending_reviews: (pendingReviewsResult.data as any[]).length,
      ending_soon: endingSoon,
      active_sales: (activePriceLists as any[]).length,
      active_selections: (endingSelections as any[]).length,
      discount_codes: activePromotions.filter((promotion) => !promotion.is_automatic)
        .length,
      automatic_discounts: activePromotions.filter(
        (promotion) => promotion.is_automatic
      ).length,
    },
    next_up: nextUp,
  })
}
