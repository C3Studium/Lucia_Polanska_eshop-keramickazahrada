import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { notifyMerchant } from "../lib/notify"
import { balancePaymentUrl } from "../lib/balance-payment-link"
import { paymentStatusFromProvider } from "../lib/payment-provider-status"
import { stageAfterBalancePaid } from "../lib/balance-payment"
import { duvodCesky, failedPaymentEmailDue } from "../lib/payment-failure"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../lib/customer-email"

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

/** ComGate's terminal failure states, in the customer's language. */
const FAILURE_REASONS: Record<string, string> = {
  canceled: "Platba byla zrušena",
  cancelled: "Platba byla zrušena",
  error: "Platbu se nepodařilo dokončit",
  expired: "Platnost platebního odkazu vypršela",
}

/** `provider_status` neúspěšně ukončené žádosti (úloha i návrat z brány). */
const FAILED_PROVIDER_STATUSES = ["CANCELED", "CANCELLED", "ERROR", "EXPIRED"]

/**
 * Tells the customer their balance payment did not go through.
 *
 * Každá neúspěšná žádost s platební relací je skutečný pokus: majitelka ji
 * pošle („sent"), nebo ji založí zákazníkovo vlastní „Doplatit" (`pay-balance`,
 * „pending"). Dřív se psalo jen u „sent" — a jen tehdy, když se zákazník
 * z brány nevrátil (návrat žádost uzavře dřív, než ji úloha uvidí), takže po
 * „Zrušit" na bráně nepřišlo nic (14. 10. 2026).
 * The retry button is the signed balance link: it never expires and creates a
 * fresh payment session on click, so it works regardless of what happened to
 * the original ComGate transaction. This is feedback on the customer's own
 * attempt, not a reminder — D4's "the system only ever notifies her" rule is
 * about chasing money, and this does not chase.
 */
const emailCustomerAboutFailure = async (
  container: MedusaContainer,
  request: any,
  status: string
) => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const [production] = (await madeToOrder.listProductionOrders({
    id: request.production_order_id,
  } as never)) as any[]
  if (!production?.order_id) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
    ],
    filters: { id: production.order_id },
  })
  const order = orders[0] as any
  if (!order) {
    return
  }

  await sendCustomerEmail(container, {
    template: "payment-failed",
    to: order.email,
    key: `payfail:${request.id}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      paymentAmount: formatMoney(request.amount, request.currency_code),
      failureReason:
        request.provider_error_reason ||
        FAILURE_REASONS[status] ||
        FAILURE_REASONS.error,
      retryLink: balancePaymentUrl(order.id) || orderLink(order),
    },
  })
}

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

  // Gate jen na otevřený stav + existující relaci. DŘÍV tu bylo i
  // `&& request.provider_transaction_id`, jenže self-service / e-mailové
  // doplatky ho neměly nastavený → úloha je přeskakovala a zaplacený doplatek
  // „zmizel". Stav čteme z relace (`session.data`) níž, transId k tomu není
  // potřeba — stejně jako sesterská úloha u checkoutu gatuje jen na relaci.
  const open = requests.filter(
    (request) =>
      OPEN_STATUSES.includes(request.status) && request.payment_session_id
  )

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

      // The provider tells us; we do not infer from age or guesswork.
      const result = await paymentStatusFromProvider(container, session as any)

      const status = String(result?.status ?? "").toLowerCase()

      if (status === "captured" || status === "authorized") {
        // Nativní zaúčtování: relace doplatku byla jen VYTVOŘENÁ, ne
        // autorizovaná, takže v kolekci není žádný `Payment` k zachycení —
        // `processPaymentWorkflow` s `captured` relaci autorizuje do platby
        // A zachytí (táž cesta jako ověřený webhook i dohled checkoutu). Bez
        // toho zůstane kolekce doplatku `not_paid`, i když je u brány zaplaceno.
        // Best-effort — produkční strana (žádost/fáze/event) jede tak jako tak.
        try {
          await processPaymentWorkflow(container).run({
            input: {
              action: "captured",
              data: {
                session_id: request.payment_session_id,
                amount: request.amount,
              },
            } as never,
          })
        } catch (error) {
          logger.warn(
            `[balance] Nativní zaúčtování doplatku ${request.id} se nepodařilo: ${
              error instanceof Error ? error.message : "neznámá chyba"
            }`
          )
        }

        await madeToOrder.updateProductionPaymentRequests({
          id: request.id,
          status: "paid",
          provider_status: "PAID",
          paid_at: request.paid_at || now,
          last_checked_at: now,
        } as never)

        // The callback never landed, so the stage never advanced either —
        // but only a finished piece moves on (`stageAfterBalancePaid`).
        const [production] = (await madeToOrder.listProductionOrders({
          id: request.production_order_id,
        } as never)) as any[]

        if (production && stageAfterBalancePaid(production.stage)) {
          await madeToOrder.updateProductionOrders({
            id: production.id,
            stage: "ready_to_ship",
            ready_to_ship_at: production.ready_to_ship_at || now,
          } as never)
        }

        logger.info(
          `[balance] Doplatek ${request.id} byl u ComGate zaplacený, doplňujeme to zpětně.`
        )

        // Webhook nedorazil → event „doplatek zaplacen" nevznikl, takže zákazník
        // nedostal potvrzení ani doplatkovou fakturu (obojí visí na tomhle eventu
        // v customer-emails onBalancePaid). Doženeme to tady — stejný payload jako
        // webhook. Idempotentní: onBalancePaid dedupuje e-mail (balpaid:{request})
        // i fakturu (metadata), takže pozdní webhook to nezdvojí. Jen pro doplatek;
        // záloha má vlastní cestu (initialize-merchant-order).
        if (request.type === "balance" && production?.order_id) {
          const eventBus = container.resolve(Modules.EVENT_BUS)
          await eventBus.emit({
            name: "made-to-order.balance-paid",
            data: {
              order_id: production.order_id,
              production_order_id: request.production_order_id,
              payment_request_id: request.id,
              amount: request.amount,
              currency_code: request.currency_code,
            },
          })
        }

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
        // E-mail zákazníkovi tu nejde — pošle ho průchod níž s odstupem, stejně
        // jako u žádostí, které uzavřel návrat z brány.
        await madeToOrder.updateProductionPaymentRequests({
          id: request.id,
          status: "expired",
          provider_status: status.toUpperCase(),
          provider_error_reason: duvodCesky(
            (result?.data as any)?.paymentErrorReason
          ),
          last_checked_at: now,
        } as never)

        await notifyMerchant(container, {
          key: `mn:payfail:${request.id}`,
          title: "Platba doplatku se nezdařila",
          description:
            "Odkaz vypršel nebo byl zrušený. Zákazníkovi odejde e-mail s odkazem na opakování platby; nový odkaz můžete poslat i přes tlačítko Požádat o doplatek.",
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

  // „Neprošla" zákazníkovi — za doplatky, které skončily neúspěchem (tady výš,
  // nebo hned po návratu z brány v `reconcileBalanceOnReturn`), s odstupem
  // `failedPaymentEmailDue`. Nový pokus na stejnou částku žádost vrátí do
  // „pending" (vypadne odsud); nový na jinou částku nebo zaplaceno = neposílat.
  // Klíč `payfail:{žádost}` drží jeden e-mail na žádost.
  const failed = requests.filter(
    (request) =>
      request.type === "balance" &&
      request.status === "expired" &&
      request.payment_session_id &&
      FAILED_PROVIDER_STATUSES.includes(
        String(request.provider_status ?? "").toUpperCase()
      ) &&
      failedPaymentEmailDue(request.updated_at, now)
  )

  for (const request of failed) {
    const superseded = requests.some(
      (other) =>
        other.id !== request.id &&
        other.type === "balance" &&
        other.production_order_id === request.production_order_id &&
        (other.status === "paid" || OPEN_STATUSES.includes(other.status))
    )
    if (superseded) {
      continue
    }
    try {
      await emailCustomerAboutFailure(
        container,
        request,
        String(request.provider_status).toLowerCase()
      )
    } catch (error) {
      logger.warn(
        `[balance] E-mail o neúspěšném doplatku ${request.id} se nepodařilo zařadit: ${
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
