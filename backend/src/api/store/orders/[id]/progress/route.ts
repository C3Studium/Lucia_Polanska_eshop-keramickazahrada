import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { balancePaymentUrl } from "../../../../../lib/balance-payment-link"
import { outstandingFor } from "../../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"
import {
  customerStageLabel,
  type CustomerOrderProgress,
} from "./labels"
import { verifyOrderAccessToken } from "../../../../../lib/order-access-link"
import { listOrderClaims } from "../../../../../lib/claims/context"
import { customerOrderStatus } from "../../../../../lib/order-customer-status"
import { isPersonalPickupOrder } from "../../../../../lib/personal-pickup"
import { toNumber } from "../../../../../lib/claims/refund-rules"

/**
 * „Kde je moje objednávka?" — the two things a customer can ask that the
 * native store API cannot answer.
 *
 * ## Why this route exists
 *
 * Medusa exposes `fulfillment_status` and `payment_status`, which jump straight
 * from *not fulfilled* to *shipped*. Between those sits the part the customer
 * actually waits through — the piece being made — and it is tracked in the
 * merchant-order module, which had no store surface at all. So the honest
 * answer to „is anyone working on this?" was unavailable, and the storefront
 * would have had to approximate it from fulfillment status. An approximation
 * here reads as a promise, which is the wrong thing to guess at.
 *
 * The outstanding balance has the same problem: it was computed for the
 * e-mails and nowhere else, so „Doplatit" could exist in an inbox but not in
 * the customer's own account.
 *
 * Both are the same question — *what is true about my order beyond what Medusa
 * models* — so they are one request rather than two.
 *
 * ## Access
 *
 * Customer-authenticated (see `middlewares.ts`), and the order must belong to
 * the caller. A mismatch returns **404, not 403**: telling a stranger that an
 * order id exists but is not theirs is itself a disclosure, and order ids are
 * guessable enough to be worth enumerating.
 *
 * Host (bez přihlášení) se dostane dovnitř jen s PODEPSANÝM tokenem objednávky
 * (`?token=`, stejný jako u úpravy a reklamací — `lib/order-access-link`). Bez
 * něj stránka objednávky hostovi ukazovala napořád „Přijato" (14. 10. 2026).
 * E-mailová adresa jako klíč se nepřijímá — stav by pak přečetl kdokoli, kdo ji zná.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderId = req.params.id
  const customerId = req.auth_context?.actor_id
  const token = typeof req.query.token === "string" ? req.query.token : ""
  const tokenOk = Boolean(token) && verifyOrderAccessToken(orderId, token)

  if (!customerId && !tokenOk) {
    res.status(401).json({ message: "Přihlaste se prosím." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "currency_code",
      "status",
      "shipping_methods.data",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "payment_collections.payments.amount",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.refunds.amount",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any

  // Same response for "no such order" and "not yours" — see the note above.
  if (!order || (!tokenOk && order.customer_id !== customerId)) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }

  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const [merchantOrder] = (await merchantOrders.listMerchantOrderStates({
    order_id: orderId,
  } as never)) as any[]

  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]

  let outstanding = 0
  // The making-of, entries she chose to share. Newest first, capped — a
  // customer page, not an archive.
  let making: { text: string | null; image_url: string | null; at: string }[] =
    []

  if (productionOrder) {
    const visibleNotes = (await madeToOrder
      .listProductionNotes(
        { order_id: orderId, visible_to_customer: true } as never,
        { order: { created_at: "DESC" }, take: 20 } as never
      )
      .catch(() => [])) as any[]
    making = visibleNotes.map((note) => ({
      text: note.text ?? null,
      image_url: note.image_url ?? null,
      at: note.created_at,
    }))
    const requests = (await madeToOrder.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as never)) as any[]
    outstanding = outstandingFor(productionOrder, requests)
  }

  const stage = merchantOrder?.stage ?? null

  const fulfillments = ((order.fulfillments ?? []) as any[]).filter((f) => !f?.canceled_at)
  const payments = ((order.payment_collections ?? []) as any[])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment: any) => payment && !payment.canceled_at)
  const paid = payments.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0)
  const refunded = payments
    .flatMap((p: any) => p.refunds ?? [])
    .reduce((sum: number, r: any) => sum + toNumber(r?.amount), 0)
  const claims = await listOrderClaims(req.scope, orderId).catch(() => [])

  const status = customerOrderStatus({
    canceled: order.status === "canceled",
    merchantStage: stage,
    production: productionOrder
      ? { stage: String(productionOrder.stage), outstanding }
      : null,
    pickup: isPersonalPickupOrder(order),
    shipped: fulfillments.some((f) => f?.shipped_at),
    delivered: fulfillments.some((f) => f?.delivered_at),
    fullyRefunded: paid > 0.005 && refunded >= paid - 0.01,
    claims,
  })

  const body: CustomerOrderProgress = {
    stage,
    stage_label: status.label ?? customerStageLabel(stage),
    status,
    stage_changed_at: merchantOrder?.stage_changed_at ?? null,
    made_to_order: Boolean(productionOrder),
    /** „Slíbeno do" — the date she committed to, when she has. */
    promised_at: productionOrder?.estimated_completion_at ?? null,
    /** Entries from the diary she explicitly shared — photos of the making. */
    making,
    // Signed link, built by the backend. The storefront cannot construct one,
    // which is why it is returned here rather than left to the client.
    balance: outstanding > 0
      ? {
          outstanding,
          currency_code: String(productionOrder?.currency_code || order.currency_code || "czk"),
          payment_url: balancePaymentUrl(orderId),
        }
      : null,
  }

  res.status(200).json(body)
}
