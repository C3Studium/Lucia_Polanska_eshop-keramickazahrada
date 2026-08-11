import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmOrderEditRequestWorkflow } from "@medusajs/medusa/core-flows"
import { notifyMerchant } from "../lib/notify"

/**
 * Zaplacený rozdíl potvrzuje zákaznickou úpravu (Matěj, 2026-08-07).
 *
 * Řetěz ověřený proti kódu: ComGate webhook mapuje jen server-verified PAID
 * na „captured", hook pustí processPaymentWorkflow vždy (MTO-sync se bez
 * requestu tiše vrátí), payment.captured pak rozdá práci třem subscriberům:
 * customer-emails pošle zákazníkovi payment-received (proto TENHLE subscriber
 * žádný e-mail neposílá — posílal by ho podruhé), reconcile-merchant-order
 * srovná stav objednávky, a my potvrdíme čekající změnu.
 *
 * Projekce schválně ve dvou krocích přes vlastní id (payment →
 * payment_session), žádné spoléhání na cross-modulové linky — session.data
 * nese order_change_id + order_id, které jsme tam při vzniku brány uložili.
 */
export default async function orderEditPaymentHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query
    .graph({
      entity: "payment",
      fields: ["id", "captured_at", "payment_session_id"],
      filters: { id: data.id } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  const payment = (payments as any[])[0]
  if (!payment?.captured_at || !payment.payment_session_id) return

  const { data: sessions } = await query
    .graph({
      entity: "payment_session",
      fields: ["id", "data"],
      filters: { id: payment.payment_session_id } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  const sessionData = ((sessions as any[])[0]?.data ?? {}) as any
  const changeId = sessionData.order_change_id
  const orderId = sessionData.order_id
  if (!changeId || !orderId) return

  try {
    await confirmOrderEditRequestWorkflow(container).run({
      input: { order_id: orderId } as never,
    })
  } catch (error) {
    container
      .resolve("logger")
      .warn(
        `[order-edit] Potvrzení změny ${changeId} po platbě selhalo (nejspíš už proběhlo): ${
          error instanceof Error ? error.message : "?"
        }`
      )
    return
  }

  const { data: orders } = await query
    .graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { id: orderId } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  const displayId = (orders as any[])[0]?.display_id

  await notifyMerchant(container, {
    key: `customer-edit-paid:${changeId}`,
    title: `Zákazník upravil a doplatil objednávku #${displayId ?? orderId}`,
    description: "Rozdíl je zaplacený, úprava je potvrzená.",
    audience: "owner",
    email: true,
    resource: { id: orderId, type: "order" },
  }).catch(() => {})
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
