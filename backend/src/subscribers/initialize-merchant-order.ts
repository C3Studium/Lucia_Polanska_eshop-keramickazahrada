import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  MADE_TO_ORDER_MODULE,
} from "../modules/made-to-order"
import MadeToOrderModuleService from "../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../modules/merchant-order"
import MerchantOrderModuleService from "../modules/merchant-order/service"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return Number(candidate.value ?? candidate.numeric_ ?? candidate.raw ?? 0)
  }
  return Number(value ?? 0)
}

const isPaidCollection = (collection: any) => {
  const status = String(collection?.status || "").toLowerCase()
  return (
    ["authorized", "completed", "captured"].includes(status) ||
    (Array.isArray(collection?.payments) && collection.payments.length > 0)
  )
}

/**
 * Creates the client-facing workflow records after Medusa has durably placed
 * an order. The handler is deliberately idempotent because event delivery is
 * at-least-once.
 */
export default async function initializeMerchantOrder({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrderService = container.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrderService = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "currency_code",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.metadata",
      "payment_collections.*",
      "payment_collections.payment_sessions.*",
      "payment_collections.payments.*",
    ],
    filters: { id: data.id },
  })
  const order = orders[0]
  if (!order) return

  const existingStates = await merchantOrderService.listMerchantOrderStates({
    order_id: order.id,
  })
  if (!existingStates.length) {
    await merchantOrderService.createMerchantOrderStates({
      order_id: order.id,
      stage: "received",
      stage_changed_at: new Date(),
    })
  }

  const existingProductionOrders =
    await madeToOrderService.listProductionOrders({ order_id: order.id })
  if (existingProductionOrders.length) return

  const paymentCollection = (order.payment_collections || []).find(
    (collection: any) => collection?.metadata?.made_to_order
  )
  const productionLines = paymentCollection?.metadata?.production_lines
  if (!paymentCollection || !Array.isArray(productionLines) || !productionLines.length) {
    return
  }

  const originalTotal = toNumber(
    paymentCollection.metadata.original_cart_total ?? order.total
  )
  const depositAmount = toNumber(paymentCollection.amount)
  const depositPercentage = originalTotal > 0
    ? Math.round((depositAmount / originalTotal) * 10_000) / 100
    : 100
  const specifications = productionLines
    .map((line: any) => line?.specification)
    .filter((value: unknown): value is string =>
      typeof value === "string" && Boolean(value.trim())
    )
  const productionOrder = await madeToOrderService.createProductionOrders({
    order_id: order.id,
    stage: specifications.length ? "specification_pending" : "confirmed",
    deposit_percentage: depositPercentage,
    agreed_total: originalTotal,
    original_total: originalTotal,
    currency_code: String(order.currency_code || "czk").toLowerCase(),
    customer_note: specifications.join("\n\n") || null,
  })

  const paymentSession = paymentCollection.payment_sessions?.[0]
  const payment = paymentCollection.payments?.[0]
  const providerData = payment?.data || paymentSession?.data || {}
  const paid = isPaidCollection(paymentCollection)
  await madeToOrderService.createProductionPaymentRequests({
    type: "deposit",
    status: paid ? "paid" : "pending",
    amount: depositAmount,
    currency_code: String(order.currency_code || "czk").toLowerCase(),
    payment_collection_id: paymentCollection.id,
    payment_session_id: paymentSession?.id || null,
    provider_transaction_id:
      providerData.transId || providerData.trans_id || null,
    payment_url: providerData.redirect || providerData.payment_url || null,
    selected_method: providerData.method || null,
    provider_status: paid ? "PAID" : String(providerData.status || "PENDING"),
    create_state: "created",
    idempotency_key: `deposit:${order.id}`,
    paid_at: paid ? new Date() : null,
    last_checked_at: new Date(),
    production_order_id: productionOrder.id,
  } as any)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}

