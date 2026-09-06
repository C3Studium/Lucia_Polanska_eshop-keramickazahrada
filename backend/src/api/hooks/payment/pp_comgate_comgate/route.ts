import { processPaymentWorkflow } from "@medusajs/core-flows"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { ProviderWebhookPayload } from "@medusajs/types"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { resolveComgateTransactionId } from "../../../../modules/comgate/utils"

const PROVIDER_ID = "pp_comgate_comgate"

const reconcileMadeToOrderPayment = async (
  req: MedusaRequest,
  sessionId: string,
  transId: string
) => {
  const service = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const requests = await service.listProductionPaymentRequests(
    { payment_session_id: sessionId },
    { relations: ["production_order"] }
  )

  // The initial deposit record may be created by the idempotent order.placed
  // subscriber immediately after this callback completes the cart. Balance
  // requests already exist here and are reconciled synchronously.
  if (!requests.length) {
    return
  }
  if (requests.length !== 1) {
    throw new Error(
      `Expected one made-to-order payment request for session ${sessionId}`
    )
  }

  const request = requests[0] as any
  if (
    request.provider_transaction_id &&
    request.provider_transaction_id !== transId
  ) {
    throw new Error(
      `Comgate transaction does not match made-to-order request ${request.id}`
    )
  }

  const now = new Date()
  await service.updateProductionPaymentRequests({
    id: request.id,
    status: "paid",
    provider_transaction_id: transId,
    provider_status: "PAID",
    provider_error_reason: null,
    create_state: "created",
    paid_at: request.paid_at || now,
    last_checked_at: now,
  } as any)

  if (request.type !== "balance") {
    return
  }

  const productionOrder = request.production_order
  if (!productionOrder?.id) {
    throw new Error(
      `Made-to-order balance request ${request.id} has no production order`
    )
  }

  // Never reopen a terminal production order. Every other stage can advance
  // once Comgate has independently confirmed the outstanding balance as paid.
  if (!["completed", "cancelled", "ready_to_ship"].includes(productionOrder.stage)) {
    await service.updateProductionOrders({
      id: productionOrder.id,
      stage: "ready_to_ship",
      ready_to_ship_at: productionOrder.ready_to_ship_at || now,
    } as any)
  }

  // D4 makes the balance flow entirely manual: she asked for the money, and
  // this is the moment she has been waiting for. The notification is emitted as
  // an event rather than sent inline so that a notification problem can never
  // fail a verified payment callback — Comgate would retry the whole thing.
  const eventBus = req.scope.resolve(Modules.EVENT_BUS)
  await eventBus.emit({
    name: "made-to-order.balance-paid",
    data: {
      order_id: productionOrder.order_id,
      production_order_id: productionOrder.id,
      payment_request_id: request.id,
      amount: request.amount,
      currency_code: request.currency_code,
    },
  })
}

/**
 * Synchronous, verified Comgate callback.
 *
 * This static route intentionally takes precedence over Medusa's generic
 * `/hooks/payment/[provider]` route. Comgate expects a 2xx acknowledgement only
 * after the notification has been accepted. The provider verifies the callback
 * secret and then queries Comgate's status API before this route mutates Medusa.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const event: ProviderWebhookPayload = {
    provider: PROVIDER_ID,
    payload: {
      data: (req.body || {}) as Record<string, unknown>,
      rawData: req.rawBody || Buffer.from(""),
      headers: req.headers as Record<string, unknown>,
    },
  }

  const logger = req.scope.resolve("logger")
  const telo = (req.body || {}) as Record<string, unknown>

  /*
   * Že oznámení vůbec dorazilo, je první věc, kterou je při ladění potřeba
   * vědět — adresu pro oznámení si ComGate drží ve svém portálu, ne v našem
   * kódu, takže mlčení tady znamená „chodí to jinam", ne „platba neprošla".
   * Vypisuje se jen číslo transakce a stav; tělo může nést tajemství.
   */
  logger.info(
    `[comgate] oznámení přijato: transId=${telo.transId ?? "-"} stav=${telo.status ?? "-"} refId=${telo.refId ?? "-"}`
  )

  try {
    const paymentModule = req.scope.resolve(Modules.PAYMENT)
    const result = await paymentModule.getWebhookActionAndData(event)

    logger.info(
      `[comgate] ověřeno u brány: akce=${result.action} relace=${result.data?.session_id ?? "-"}`
    )

    if (result.action === "not_supported" || !result.data?.session_id) {
      /*
       * Oznámení, které se nepodařilo přiřadit — cizí, podvržené, nebo bez
       * transakce, kterou ComGate zná. To není naše chyba a opakování ho
       * nespraví: 400 říká „nepatří nám", ať se pokusy nekupí v logu vedle
       * skutečných selhání. Důvod už vypsal provider.
       */
      logger.warn(
        `[comgate] oznámení nerozpoznáno (transId=${telo.transId ?? "-"}) — nepatří nám`
      )
      return res.status(400).json({ received: false })
    }

    // Only Comgate's server-verified PAID state maps to `captured`. Intermediate
    // and cancelled states are acknowledged without completing the cart.
    if (result.action === "captured") {
      await processPaymentWorkflow(req.scope).run({ input: result })

      const sessionId = String(result.data.session_id)
      const transId = resolveComgateTransactionId({
        transId: (req.body as Record<string, unknown>)?.transId,
      })
      if (!transId) {
        throw new Error("Verified Comgate callback is missing its transaction ID")
      }
      await reconcileMadeToOrderPayment(req, sessionId, transId)

      logger.info(`[comgate] platba zaúčtována, relace ${sessionId}`)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    logger.error(
      `[comgate] zpracování oznámení selhalo (transId=${telo.transId ?? "-"})`,
      error as Error
    )
    return res.status(500).json({ received: false })
  }
}
