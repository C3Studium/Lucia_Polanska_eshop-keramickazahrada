import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { MERCHANT_ORDER_MODULE } from "../../../modules/merchant-order"
import MerchantOrderModuleService from "../../../modules/merchant-order/service"
import {
  MERCHANT_ORDER_STAGES,
  type MerchantOrderStage,
} from "../../../modules/merchant-order/stages"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"
import { toMerchantOrderRow } from "./projection"

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

/**
 * Kategorie v Objednávky+ (docs/reklamace-a-zruseni.md §11.4):
 * `cancelled` = fáze cancelled, `refunds` = k objednávce existuje žádost
 * druhu vraceni/odstoupeni, `claims` = druhu reklamace.
 *
 * Filtr se aplikuje PŘED stránkováním, na úrovni DB: pro `refunds`/`claims`
 * se napřed jedním dotazem vezmou `order_id` žádostí daného druhu a stavy se
 * pak filtrují `order_id IN (…)` + take/skip. `count` je tedy počet objednávek
 * v kategorii a `limit`/`offset` jimi listují stejně jako u `stage`.
 * Kategorie a `stage` se skládají (AND); `cancelled` prostě vynutí
 * `stage = cancelled`.
 */
export type MerchantOrderCategory = "cancelled" | "refunds" | "claims"

const CATEGORY_KINDS: Record<Exclude<MerchantOrderCategory, "cancelled">, string[]> = {
  refunds: ["vraceni", "odstoupeni"],
  claims: ["reklamace"],
}

const categoryOf = (value: unknown): MerchantOrderCategory | null =>
  value === "cancelled" || value === "refunds" || value === "claims" ? value : null

/**
 * Fields handed to `getOrdersListWorkflow`.
 *
 * `items.*` is mandatory rather than a convenience: `order.total` is not a column,
 * it is derived by `decorateCartTotals()` from `unit_price * quantity`. Selecting a
 * narrow subset of item columns silently yields wrong totals, because MikroORM drops
 * unlisted columns from the projection. The native list workflow adds `items.*` for
 * exactly this reason, and we mirror it.
 *
 * `payment_collections` / `fulfillments` are requested explicitly because the workflow
 * strips them from its output unless the caller asked for them, and we need them for
 * the payment and shipping badges.
 */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  "total",
  // `metadata.refund_due` drives the „Vrátit rozdíl" button in the queue.
  "metadata",
  "items.*",
  // `summary` and the collection amounts are what the A2 ship gate compares —
  // the card must not offer an action the backend would refuse.
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
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  // Whether the dobírka money already arrived — the „Peníze přišly" button.
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  // Zachyceno − vráceno pro `claim.remaining` (§11.4) — stejný výpočet jako
  // v modulu reklamací (`moneyState`), proto i stejná pole.
  "payment_collections.payments.amount",
  "payment_collections.payments.refunds.amount",
  "fulfillments.id",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<MerchantOrderModuleService>(MERCHANT_ORDER_MODULE)
  const returnRequests = req.scope.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const category = categoryOf(req.query.category)
  const stage =
    category === "cancelled"
      ? ("cancelled" as MerchantOrderStage)
      : typeof req.query.stage === "string" &&
          MERCHANT_ORDER_STAGES.includes(req.query.stage as MerchantOrderStage)
        ? (req.query.stage as MerchantOrderStage)
        : undefined

  // Jeden dotaz na všechny žádosti: dá order_id pro filtr kategorie i počty
  // do záložek (`categories`). Žádostí jsou desítky, ne tisíce.
  const allRequests = (await returnRequests
    .listReturnRequests({} as never, { select: ["id", "order_id", "kind"] } as never)
    .catch(() => [])) as Array<{ order_id?: string; kind?: string | null }>
  const orderIdsByKinds = (kinds: string[]): string[] => [
    ...new Set(
      allRequests
        .filter((request) => kinds.includes(request.kind ?? ""))
        .map((request) => request.order_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ]

  const stateFilters: Record<string, unknown> = stage ? { stage } : {}
  let categoryEmpty = false
  if (category === "refunds" || category === "claims") {
    const ids = orderIdsByKinds(CATEGORY_KINDS[category])
    // Prázdný `order_id: []` by MikroORM mohl přeložit na „bez filtru" —
    // žádná žádost = žádná objednávka v kategorii, bez dotazu.
    if (!ids.length) {
      categoryEmpty = true
    } else {
      stateFilters.order_id = ids
    }
  }

  const [states, count] = categoryEmpty
    ? [[] as any[], 0]
    : await service.listAndCountMerchantOrderStates(stateFilters as any, {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      })

  const orderIds = states.map((state: any) => state.order_id)

  // Žádosti modulu reklamací ke VŠEM objednávkám stránky jedním dotazem
  // (§11.4) — `claim` v řádku a důvod zrušení; žádné N+1.
  const pageRequests = orderIds.length
    ? ((await returnRequests
        .listReturnRequests({ order_id: orderIds } as never)
        .catch(() => [])) as any[])
    : []
  const requestsByOrderId = new Map<string, any[]>()
  for (const request of pageRequests) {
    const list = requestsByOrderId.get(request.order_id) || []
    list.push(request)
    requestsByOrderId.set(request.order_id, list)
  }

  // Orders always come from the native list workflow. It is the only supported way to
  // obtain `total`, `payment_status` and `fulfillment_status`: the first is derived from
  // the full item projection, the latter two do not exist on the `order` entity at all
  // and are computed by `getLastPaymentStatus()` / `getLastFulfillmentStatus()` inside
  // this workflow.
  let orders: any[] = []
  if (orderIds.length) {
    const { result } = await getOrdersListWorkflow(req.scope).run({
      input: {
        fields: ORDER_FIELDS,
        variables: { filters: { id: orderIds } },
      },
    })
    // The workflow returns a bare array when no pagination is requested, and
    // `{ rows, metadata }` when it is. Pagination happens on the state table here,
    // but normalise both shapes so this cannot silently break.
    orders = Array.isArray(result) ? result : ((result as any)?.rows ?? [])
  }

  // Read-only module links are uni-directional: `production_order -> order` can only be
  // traversed from `production_order`. Querying `production_order` from `order` silently
  // returns nothing, which is why the made-to-order badge never rendered.
  const { data: productionOrders } = orderIds.length
    ? await query.graph({
        entity: "production_order",
        fields: [
          "id",
          "order_id",
          "stage",
          "agreed_total",
          "original_total",
          // Příplatek — brána (ship_block_reason) ho započítá do dluhu.
          "surcharge",
          "payment_requests.status",
          "payment_requests.amount",
        ],
        filters: { order_id: orderIds },
      })
    : { data: [] as any[] }

  // Order changes are a separate entity, and an open one means the total is
  // still moving — the gate has to see them.
  const { data: orderChanges } = orderIds.length
    ? await query.graph({
        entity: "order_change",
        fields: ["id", "order_id", "status"],
        filters: { order_id: orderIds },
      })
    : { data: [] as any[] }

  const orderById = new Map(orders.map((order: any) => [order.id, order]))
  const productionByOrderId = new Map(
    productionOrders.map((production: any) => [production.order_id, production])
  )
  const changesByOrderId = new Map<string, any[]>()
  for (const change of orderChanges as any[]) {
    const existing = changesByOrderId.get(change.order_id) || []
    existing.push(change)
    changesByOrderId.set(change.order_id, existing)
  }

  const rows = states.map((state: any) =>
    toMerchantOrderRow(
      state,
      orderById.get(state.order_id) || null,
      productionByOrderId.get(state.order_id) || null,
      changesByOrderId.get(state.order_id) || [],
      requestsByOrderId.get(state.order_id) || []
    )
  )

  // Counting per stage keeps this O(stages) indexed count queries instead of loading
  // every state row into memory just to bucket it.
  const summaryEntries = await Promise.all(
    MERCHANT_ORDER_STAGES.map(async (item) => {
      const [, stageCount] = await service.listAndCountMerchantOrderStates(
        { stage: item } as any,
        { take: 1 }
      )
      return [item, stageCount] as const
    })
  )
  const summary = Object.fromEntries(summaryEntries) as Record<
    MerchantOrderStage,
    number
  >

  // Počty do záložek Zrušené · Vrácení peněz · Reklamace (§11.4) — objednávky,
  // ne žádosti (dvě žádosti na jedné objednávce = jeden řádek).
  const categories: Record<MerchantOrderCategory, number> = {
    cancelled: summary.cancelled ?? 0,
    refunds: orderIdsByKinds(CATEGORY_KINDS.refunds).length,
    claims: orderIdsByKinds(CATEGORY_KINDS.claims).length,
  }

  res.status(200).json({ orders: rows, count, limit, offset, summary, categories })
}
