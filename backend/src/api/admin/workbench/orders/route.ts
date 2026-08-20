import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../modules/merchant-order/service"

/**
 * Objednávky — the advanced order worklist (admin-advanced-plan.md).
 *
 * Přehled's Denní práce answers „what do I do next?" for the orders inside
 * the merchant workflow. This answers the deeper question — „what is true of
 * *every* order?" — by joining the three systems that each hold a third of it:
 * Medusa's order (money asked), the payment collections (money received),
 * and the merchant/production modules (stage and balance). No page showed
 * those side by side before; reconciling them meant three tabs and a
 * notebook.
 *
 * ## Reading the money columns
 *
 * `captured` sums payments by `captured_at`, minus refunds — the same
 * captured-minus-refunded quantity the A2 ship gate compares against the
 * total, so this list and the gate can never tell different stories about
 * who has paid. `outstanding` is the production module's own
 * `agreed_total − paid requests` (shared `outstandingFor`), which is what
 * the balance e-mails use. The two columns deliberately come from different
 * systems: one is card money, the other is commission bookkeeping, and
 * showing them as one number is how a pickup order that authorized-but-not-
 * captured gets shipped.
 *
 * Filters: `?stage=`, `?q=` (e-mail or order number), `?owing=true`,
 * `?limit/offset`.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const stageParam =
    typeof req.query.stage === "string" ? req.query.stage : null
  const searchParam =
    typeof req.query.q === "string" ? req.query.q.trim() : ""

  const ORDER_FIELDS = [
    "id",
    "display_id",
    "status",
    "email",
    "currency_code",
    "created_at",
    "total",
    "customer.id",
    "customer.first_name",
    "customer.last_name",
    "items.id",
    "items.quantity",
    "shipping_methods.name",
    "shipping_methods.shipping_option.provider_id",
    "fulfillments.id",
    "fulfillments.shipped_at",
    "fulfillments.delivered_at",
    "fulfillments.canceled_at",
    "payment_collections.payments.amount",
    "payment_collections.payments.captured_at",
    "payment_collections.payments.refunds.amount",
  ]

  /*
   * Filtering happens IN the database, not on one page of results. The first
   * version paginated first (newest 50) and filtered after — searching for an
   * order from three months ago silently returned „nic", and the tab counts
   * described one page of the shop, not the shop.
   *
   * Search matches the order number exactly and the e-mail as a substring —
   * the two things she actually has in hand when a customer calls.
   */
  const searchFilters = () => {
    if (!searchParam) return {}
    const conditions: Record<string, unknown>[] = [
      { email: { $ilike: `%${searchParam}%` } },
    ]
    const numeric = Number(searchParam.replace(/^#/, ""))
    if (Number.isInteger(numeric) && numeric > 0) {
      conditions.push({ display_id: numeric })
    }
    return { $or: conditions }
  }

  let orders: any[] = []
  let totalCount = 0

  if (stageParam && stageParam !== "dluzi") {
    // Stage lives on the merchant-order state table — paginate THERE, then
    // fetch exactly those orders (same pattern as /admin/merchant-orders).
    const [states, stateCount] =
      await merchantOrders.listAndCountMerchantOrderStates(
        { stage: stageParam } as never,
        searchParam
          ? { take: 1000, order: { created_at: "DESC" } }
          : { take: limit, skip: offset, order: { created_at: "DESC" } }
      )
    const stageOrderIds = (states as any[]).map((state) => state.order_id)
    totalCount = stateCount
    if (stageOrderIds.length) {
      const result = (await query.graph({
        entity: "order",
        fields: ORDER_FIELDS,
        filters: { id: stageOrderIds, ...searchFilters() } as never,
        ...(searchParam
          ? {
              pagination: {
                take: limit,
                skip: offset,
                order: { created_at: "DESC" },
              },
            }
          : {}),
      })) as any
      orders = result.data
      if (searchParam) {
        totalCount = result.metadata?.count ?? orders.length
      }
    } else {
      orders = []
    }
  } else {
    // „Vše" and „dluzi": newest-first over every order, search applied in-DB.
    const result = (await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { ...searchFilters() } as never,
      pagination: {
        // The owing filter needs the money computed first — scan a wider
        // window so it has something real to filter (MTO orders are few).
        take: req.query.owing === "true" ? 500 : limit,
        skip: req.query.owing === "true" ? 0 : offset,
        order: { created_at: "DESC" },
      },
    })) as any
    orders = result.data
    totalCount = result.metadata?.count ?? orders.length
  }

  const orderIds = (orders as any[]).map((order) => order.id)

  const [states, productionOrders] = await Promise.all([
    orderIds.length
      ? (merchantOrders.listMerchantOrderStates({
          order_id: orderIds,
        } as never) as Promise<any[]>)
      : ([] as any[]),
    orderIds.length
      ? (madeToOrder.listProductionOrders({
          order_id: orderIds,
        } as never) as Promise<any[]>)
      : ([] as any[]),
  ])

  const stageByOrder = new Map(
    (states as any[]).map((state) => [state.order_id, state])
  )
  const productionByOrder = new Map(
    (productionOrders as any[]).map((production) => [
      production.order_id,
      production,
    ])
  )

  const productionIds = (productionOrders as any[]).map(
    (production) => production.id
  )
  const requests = productionIds.length
    ? ((await madeToOrder.listProductionPaymentRequests({
        production_order_id: productionIds,
      } as never)) as any[])
    : []
  const requestsByProduction = new Map<string, any[]>()
  for (const request of requests) {
    const list = requestsByProduction.get(request.production_order_id) ?? []
    list.push(request)
    requestsByProduction.set(request.production_order_id, list)
  }

  const toNumber = (value: unknown): number => {
    const parsed = Number(
      typeof value === "object" && value !== null
        ? ((value as any).value ?? (value as any).numeric_ ?? 0)
        : value
    )
    return Number.isFinite(parsed) ? parsed : 0
  }
  const round = (value: number) => Math.round(value * 100) / 100

  const owingOnly = req.query.owing === "true"

  const mappedAll = (orders as any[])
    .map((order) => {
      const payments = (order.payment_collections ?? []).flatMap(
        (collection: any) => collection?.payments ?? []
      )
      const captured = round(
        payments
          .filter((payment: any) => payment?.captured_at)
          .reduce(
            (sum: number, payment: any) => sum + toNumber(payment.amount),
            0
          )
      )
      const refunded = round(
        payments
          .flatMap((payment: any) => payment?.refunds ?? [])
          .reduce(
            (sum: number, refund: any) => sum + toNumber(refund.amount),
            0
          )
      )

      const production = productionByOrder.get(order.id)
      const outstanding = production
        ? outstandingFor(
            production,
            requestsByProduction.get(production.id) ?? []
          )
        : 0

      const fulfillments = order.fulfillments ?? []
      const state = stageByOrder.get(order.id)

      const isPickup = (order.shipping_methods ?? []).some((method: any) =>
        String(method?.shipping_option?.provider_id ?? "").includes("pickup")
      )

      return {
        // Expert mode (?expert=1): the whole graph row rides along, so the
        // UI's „Surová data" shows exactly what the backend saw — metadata,
        // provider ids, every payment — with no second request.
        ...(req.query.expert === "1" ? { raw: order } : {}),
        id: order.id,
        display_id: order.display_id,
        created_at: order.created_at,
        email: order.email,
        customer_id: order.customer?.id ?? null,
        customer_name:
          [order.customer?.first_name, order.customer?.last_name]
            .filter(Boolean)
            .join(" ") || null,
        currency_code: order.currency_code,
        total: round(toNumber(order.total)),
        captured,
        refunded,
        paid: round(captured - refunded),
        items_count: (order.items ?? []).length,
        stage: state?.stage ?? null,
        stage_changed_at: state?.stage_changed_at ?? null,
        made_to_order: Boolean(production),
        production_stage: production?.stage ?? null,
        outstanding,
        is_personal_pickup: isPickup,
        shipped: fulfillments.some((f: any) => f?.shipped_at),
        delivered: fulfillments.some((f: any) => f?.delivered_at),
        /* Packed but not handed over — the „Na poštu" pile. */
        awaiting_handover:
          state?.stage === "shipping" &&
          fulfillments.some((f: any) => !f?.shipped_at && !f?.canceled_at),
      }
    })

  /*
   * Real counts from the state table, not from one page of rows. „dluzi" is
   * computed from the production orders already in hand (MTO orders are few).
   */
  const stageCountEntries = await Promise.all(
    (["received", "working", "shipping", "payment_problem"] as const).map(
      async (stage) => {
        const [, stageCount] =
          await merchantOrders.listAndCountMerchantOrderStates(
            { stage } as never,
            { take: 1 }
          )
        return [stage, stageCount] as const
      }
    )
  )
  const allProduction = (await madeToOrder.listProductionOrders(
    {} as never
  )) as any[]
  const allProductionIds = allProduction.map((production) => production.id)
  const allRequests = allProductionIds.length
    ? ((await madeToOrder.listProductionPaymentRequests({
        production_order_id: allProductionIds,
      } as never)) as any[])
    : []
  const allRequestsByProduction = new Map<string, any[]>()
  for (const request of allRequests) {
    const list = allRequestsByProduction.get(request.production_order_id) ?? []
    list.push(request)
    allRequestsByProduction.set(request.production_order_id, list)
  }
  const dluziCount = allProduction.filter(
    (production) =>
      outstandingFor(
        production,
        allRequestsByProduction.get(production.id) ?? []
      ) > 0
  ).length

  // The „Vše" badge counts the whole shop regardless of the active filter.
  const allOrdersResult = (await query.graph({
    entity: "order",
    fields: ["id"],
    pagination: { take: 1, skip: 0 },
  })) as any
  const counts = {
    vse: allOrdersResult.metadata?.count ?? totalCount,
    ...Object.fromEntries(stageCountEntries),
    dluzi: dluziCount,
  }

  const rows = mappedAll.filter((row) => {
      if (owingOnly && row.outstanding <= 0) return false
      return true
    })

  res.status(200).json({
    counts,
    orders: rows,
    /* Total matching the ACTIVE filter — the UI can page beyond this response. */
    count: totalCount,
    limit,
    offset,
  })
}
