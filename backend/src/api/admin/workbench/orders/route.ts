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

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
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
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.refunds.amount",
    ],
    filters: { id: { $ne: null } } as never,
    pagination: {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    },
  })

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

  const stageFilter =
    typeof req.query.stage === "string" ? req.query.stage : null
  const search =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null
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
      }
    })
  const counts = {
    vse: mappedAll.length,
    received: mappedAll.filter((r) => r.stage === "received").length,
    working: mappedAll.filter((r) => r.stage === "working").length,
    shipping: mappedAll.filter((r) => r.stage === "shipping").length,
    payment_problem: mappedAll.filter((r) => r.stage === "payment_problem")
      .length,
    dluzi: mappedAll.filter((r) => r.outstanding > 0).length,
  }

  const rows = mappedAll.filter((row) => {
      if (stageFilter && row.stage !== stageFilter) return false
      if (owingOnly && row.outstanding <= 0) return false
      if (
        search &&
        !String(row.email ?? "").toLowerCase().includes(search) &&
        !String(row.display_id ?? "").includes(search) &&
        !String(row.customer_name ?? "").toLowerCase().includes(search)
      ) {
        return false
      }
      return true
    })

  res.status(200).json({
    counts,
    orders: rows,
    count: rows.length,
    limit,
    offset,
  })
}
