import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmOrderEditRequestWorkflow } from "@medusajs/medusa/core-flows"
import { notifyMerchant } from "../lib/notify"
import { sendCustomerEmail } from "../lib/customer-email"

/**
 * Zaplacený rozdíl potvrzuje zákaznickou úpravu (Matěj, 2026-08-07).
 *
 * Karta + dražší úprava: změna čeká jako pending a TEPRVE capture platby ji
 * potvrdí — tady. Session nese order_change_id + order_id v datech; bez nich
 * je to obyčejná platba a jdeme dál. Idempotence: potvrzená změna druhé
 * potvrzení tiše přežije (workflow selže, my to spolkneme s logem).
 */
export default async function orderEditPaymentHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payments } = await query
    .graph({
      entity: "payment",
      fields: ["id", "captured_at", "payment_session.data", "payment_collection.order.id", "payment_collection.order.display_id", "payment_collection.order.email"],
      filters: { id: data.id } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  const payment = (payments as any[])[0]
  const sessionData = payment?.payment_session?.data as any
  const changeId = sessionData?.order_change_id
  const orderId = sessionData?.order_id ?? payment?.payment_collection?.order?.id
  if (!changeId || !orderId || !payment?.captured_at) {
    return
  }

  try {
    await confirmOrderEditRequestWorkflow(container).run({
      input: { order_id: orderId } as never,
    })
  } catch (error) {
    container
      .resolve("logger")
      .warn(
        `[order-edit] Potvrzení změny ${changeId} selhalo (nejspíš už potvrzena): ${
          error instanceof Error ? error.message : "?"
        }`
      )
    return
  }

  const displayId = payment?.payment_collection?.order?.display_id
  await notifyMerchant(container, {
    key: `customer-edit-paid:${changeId}`,
    title: `Zákazník upravil a doplatil objednávku #${displayId ?? orderId}`,
    description: "Rozdíl je zaplacený, úprava potvrzena.",
    audience: "owner",
    email: true,
    resource: { id: orderId, type: "order" },
  }).catch(() => {})

  const email = payment?.payment_collection?.order?.email
  if (email) {
    await sendCustomerEmail(container, {
      template: "payment-received",
      to: email,
      key: `edit-paid:${changeId}`,
      orderId,
      data: {
        customerName: "",
        orderNumber: `#${displayId ?? ""}`,
        paymentAmount: "",
      },
    }).catch(() => {})
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
