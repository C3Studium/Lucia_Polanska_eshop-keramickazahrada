import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { resolveOrderOutstanding } from "../../lib/balance-payment"

/**
 * How much a freshly placed order still owes, if anything.
 *
 * Only commissions can owe anything after checkout — an ordinary order is paid
 * in full or it is not an order. So this returns zero for everything else,
 * which is what keeps the „doplatit" button out of ordinary confirmation
 * e-mails.
 *
 * Běží na `order.placed` souběžně s `initialize-merchant-order`, takže
 * produkční objednávka se zálohou tu ještě nemusí být — doplatek se pak
 * vezme z kolekce pokladny (`payment_collections` z dotazu workflow), viz
 * `resolveOrderOutstanding`. Bez čekání: běžná objednávka nic navíc nedělá.
 */
export const resolveBalanceStep = createStep(
  "resolve-order-balance",
  async (
    { order_id, orders }: { order_id: string; orders?: any[] },
    { container }
  ) => {
    const service = container.resolve<MadeToOrderModuleService>(
      MADE_TO_ORDER_MODULE
    )
    const order = orders?.[0] ?? null

    const [productionOrder] = (await service.listProductionOrders({
      order_id,
    } as never)) as any[]

    const requests = productionOrder
      ? ((await service.listProductionPaymentRequests({
          production_order_id: productionOrder.id,
        } as never)) as any[])
      : []

    return new StepResponse({
      outstanding: resolveOrderOutstanding({
        productionOrder,
        requests,
        collections: order?.payment_collections,
      }),
      currency_code: String(
        productionOrder?.currency_code || order?.currency_code || "czk"
      ).toLowerCase(),
    })
  }
)
