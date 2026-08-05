import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"

/**
 * One customer, expanded — the Karta's second level (phase 3).
 *
 * The Karta drawer had the note and the e-mails; this adds the part she
 * previously left the page for: the order list itself, each with its
 * merchant stage and what is still owed on it. With this, the native
 * customer page has nothing left that the workbench lacks.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = req.params.customerId
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "created_at", "metadata"],
    filters: { id: customerId },
  })
  const customer = customers[0] as any
  if (!customer) {
    res.status(404).json({ message: "Zákazník nebyl nalezen." })
    return
  }

  // Person-level: guest checkouts mint a record per order, so the Karta
  // merges orders matched by this record's id AND by the person's e-mail.
  const [byId, byEmail] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["id", "display_id", "created_at", "total", "currency_code"],
      filters: { customer_id: customerId } as never,
      pagination: { take: 100, skip: 0, order: { created_at: "DESC" } },
    }),
    customer.email
      ? query
          .graph({
            entity: "order",
            fields: ["id", "display_id", "created_at", "total", "currency_code"],
            filters: { email: customer.email } as never,
            pagination: { take: 100, skip: 0, order: { created_at: "DESC" } },
          })
          .catch(() => ({ data: [] as any[] }))
      : { data: [] as any[] },
  ])
  const merged = new Map<string, any>()
  for (const row of [...(byId.data as any[]), ...(byEmail.data as any[])]) {
    merged.set(row.id, row)
  }
  const orders = [...merged.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  )

  const orderIds = orders.map((order) => order.id)
  const [states, productions] = await Promise.all([
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
    (states as any[]).map((state) => [state.order_id, state.stage])
  )
  const productionByOrder = new Map(
    (productions as any[]).map((production) => [production.order_id, production])
  )
  const productionIds = (productions as any[]).map((p) => p.id)
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

  res.status(200).json({
    id: customer.id,
    email: customer.email,
    name:
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      null,
    note:
      typeof (customer.metadata as any)?.poznamka === "string"
        ? (customer.metadata as any).poznamka
        : null,
    orders: orders.map((order) => {
      const production = productionByOrder.get(order.id)
      return {
        id: order.id,
        display_id: order.display_id,
        created_at: order.created_at,
        total: Number(order.total) || 0,
        stage: stageByOrder.get(order.id) ?? null,
        made_to_order: Boolean(production),
        outstanding: production
          ? outstandingFor(
              production,
              requestsByProduction.get(production.id) ?? []
            )
          : 0,
      }
    }),
  })
}
