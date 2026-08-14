import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DOBIRKA_PROVIDER_ID,
  ensureInvoiceForOrder,
  isDobirkaOrder,
  loadInvoiceOrder,
  markInvoicePaidForOrder,
  resolveIdokladService,
} from "../lib/idoklad-invoice"

/**
 * When an order becomes an invoice (FINISHINGTODOLIST §1).
 *
 * Two moments matter, and they differ by how the order pays:
 *
 * - **`payment.captured`** — an online payment (ComGate/Stripe), a recorded
 *   cash pickup, or a made-to-order balance arriving. The invoice is issued
 *   once the order is *fully* captured (a deposit alone is not an invoice) and
 *   immediately recorded as paid in iDoklad. For a **dobírka** capture — which
 *   in this shop means Lucia recorded that the carrier settled the money — the
 *   invoice already exists from handover, so only the payment is recorded;
 *   if it somehow does not exist yet, it is issued first.
 * - **`shipment.created`** — the handover to the carrier. Only dobírka orders
 *   react here: the customer will pay the carrier, but the goods leave today,
 *   so the (unpaid) invoice travels with them.
 *
 * Everything downstream is idempotent (`order.metadata.idoklad_*`), so
 * at-least-once event delivery is safe, and an unconfigured iDoklad makes all
 * of this a logged no-op.
 */

const onPaymentCaptured = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  // The capture event carries only the payment id; the order is reached
  // through payment -> payment_collection -> order (the traversable direction).
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "provider_id",
      "captured_at",
      "payment_collection.order.id",
    ],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const orderId = payment?.payment_collection?.order?.id
  if (!orderId || !payment?.captured_at) {
    return
  }

  const isDobirka = payment.provider_id === DOBIRKA_PROVIDER_ID

  await ensureInvoiceForOrder(container, orderId, {
    source: "payment",
    // A dobírka capture means the carrier already settled — the invoice
    // should exist from handover and, if missing, must be issued regardless
    // of what the capture sums say. Online payments gate on "fully paid" so
    // a made-to-order deposit never becomes a premature invoice.
    requireFullyCaptured: !isDobirka,
  })

  await markInvoicePaidForOrder(container, orderId, payment.captured_at)
}

const onShipmentCreated = async ({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) => {
  if (!data?.id) {
    return
  }
  // Skip the fulfillment lookup entirely when iDoklad is not configured.
  if (!resolveIdokladService(container)) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: fulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "order.id"],
    filters: { id: data.id },
  })
  const orderId = (fulfillments[0] as any)?.order?.id
  if (!orderId) {
    return
  }

  const order = await loadInvoiceOrder(container, orderId)
  if (!order || !isDobirkaOrder(order)) {
    return
  }

  await ensureInvoiceForOrder(container, orderId, { source: "handover" })
}

const handlers: Record<string, (args: SubscriberArgs<any>) => Promise<void>> = {
  "payment.captured": onPaymentCaptured,
  "shipment.created": onShipmentCreated,
}

export default async function idokladInvoiceHandler(args: SubscriberArgs<any>) {
  const handler = handlers[args.event.name]
  if (handler) {
    await handler(args)
  }
}

export const config: SubscriberConfig = {
  event: ["payment.captured", "shipment.created"],
}
