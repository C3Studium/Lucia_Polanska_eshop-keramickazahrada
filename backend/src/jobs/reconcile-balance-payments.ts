import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { notifyMerchant } from "../lib/notify"

/**
 * Asks ComGate what actually happened to balance payments nobody heard back
 * about (P6-3).
 *
 * ## Why a poller is necessary at all
 *
 * The ComGate callback is verified and reliable *when it arrives*. It can fail
 * to arrive: the server was restarting, the network blinked, the customer
 * closed the tab at the wrong moment. When that happens the money is real and
 * the shop does not know — the commission sits in „čeká na doplatek" forever,
 * she chases a customer who has already paid, and the piece never ships.
 *
 * The other direction matters too: a payment link that expired unpaid leaves a
 * request stuck in `sent` looking like it is still live, so she waits on
 * something that can no longer happen.
 *
 * Both are silent failures, which is exactly the kind this plan exists to
 * surface. Every 30 minutes this asks the provider directly.
 *
 * ## Safety
 *
 * It only ever *reflects* what ComGate says — it never decides. Requests
 * already `paid` or `cancelled` are skipped, so a re-run cannot undo a
 * settled payment, and the notifications are keyed per request.
 */

/** Requests still waiting for an answer. Anything else is settled. */
const OPEN_STATUSES = ["pending", "sent"]

export default async function reconcileBalancePayments(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const paymentModule = container.resolve(Modules.PAYMENT)

  const requests = (await madeToOrder.listProductionPaymentRequests(
    {} as never
  )) as any[]

  const open = requests.filter(
    (request) =>
      OPEN_STATUSES.includes(request.status) && request.provider_transaction_id
  )

  if (!open.length) {
    return
  }

  const now = new Date()

  for (const request of open) {
    try {
      const [session] = request.payment_session_id
        ? await paymentModule.listPaymentSessions({
            id: request.payment_session_id,
          } as never)
        : []

      if (!session) {
        continue
      }

      const provider = container.resolve(
        `pp_${(session as any).provider_id ?? ""}`.replace(/^pp_pp_/, "pp_")
      ) as any

      // The provider tells us; we do not infer from age or guesswork.
      const result = await provider.getPaymentStatus({
        data: (session as any).data ?? {},
      })

      const status = String(result?.status ?? "").toLowerCase()

      if (status === "captured" || status === "authorized") {
        await madeToOrder.updateProductionPaymentRequests({
          id: request.id,
          status: "paid",
          provider_status: "PAID",
          paid_at: request.paid_at || now,
          last_checked_at: now,
        } as never)

        // The callback never landed, so the stage never advanced either.
        const [production] = (await madeToOrder.listProductionOrders({
          id: request.production_order_id,
        } as never)) as any[]

        if (
          production &&
          !["completed", "cancelled", "ready_to_ship"].includes(production.stage)
        ) {
          await madeToOrder.updateProductionOrders({
            id: production.id,
            stage: "ready_to_ship",
            ready_to_ship_at: production.ready_to_ship_at || now,
          } as never)
        }

        logger.info(
          `[balance] Doplatek ${request.id} byl u ComGate zaplacený, doplňujeme to zpětně.`
        )

        await notifyMerchant(container, {
          key: `mn:balpaid:${request.id}`,
          title: "Doplatek přijat",
          description:
            "Potvrzení od platební brány dorazilo se zpožděním — zakázka je zaplacená a připravená k odeslání.",
          audience: "owner",
          email: true,
        })
        continue
      }

      if (["canceled", "cancelled", "error", "expired"].includes(status)) {
        await madeToOrder.updateProductionPaymentRequests({
          id: request.id,
          status: "expired",
          provider_status: status.toUpperCase(),
          last_checked_at: now,
        } as never)

        await notifyMerchant(container, {
          key: `mn:payfail:${request.id}`,
          title: "Platba doplatku se nezdařila",
          description:
            "Odkaz vypršel nebo byl zrušený. Pošlete zákazníkovi nový přes tlačítko Požádat o doplatek.",
          audience: "owner",
          urgent: true,
        })
        continue
      }

      await madeToOrder.updateProductionPaymentRequests({
        id: request.id,
        last_checked_at: now,
      } as never)
    } catch (error) {
      // One unreachable payment must not stop the rest being checked.
      logger.warn(
        `[balance] Stav doplatku ${request.id} se nepodařilo ověřit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }
}

export const config = {
  name: "reconcile-balance-payments",
  schedule: "*/30 * * * *",
}
