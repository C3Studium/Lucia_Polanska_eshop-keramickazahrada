import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { outstandingFor } from "../../lib/balance-payment"

/**
 * How much a freshly placed order still owes, if anything.
 *
 * Only commissions can owe anything after checkout — an ordinary order is paid
 * in full or it is not an order. So this returns zero for everything else,
 * which is what keeps the „doplatit" button out of ordinary confirmation
 * e-mails.
 */
export const resolveBalanceStep = createStep(
  "resolve-order-balance",
  async ({ order_id }: { order_id: string }, { container }) => {
    const service = container.resolve<MadeToOrderModuleService>(
      MADE_TO_ORDER_MODULE
    )

    const [productionOrder] = (await service.listProductionOrders({
      order_id,
    } as never)) as any[]

    if (!productionOrder) {
      return new StepResponse({ outstanding: 0, currency_code: "czk" })
    }

    const requests = (await service.listProductionPaymentRequests({
      production_order_id: productionOrder.id,
    } as never)) as any[]

    return new StepResponse({
      outstanding: outstandingFor(productionOrder, requests),
      currency_code: String(productionOrder.currency_code || "czk"),
    })
  }
)
