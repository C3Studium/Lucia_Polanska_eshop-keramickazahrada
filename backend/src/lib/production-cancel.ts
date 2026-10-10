import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"

/**
 * Zrušení ZAKÁZKY na výrobní straně — JEDNA cesta pro „Zrušit zakázku" v
 * modulu zakázek (`made-to-order/orders/:id/actions` → `cancel`) i pro
 * „Zrušit zakázku" ze žádosti v Reklamace a zrušení
 * (docs/reklamace-a-zruseni.md §12.4, `cancel-production`).
 *
 * Co se tu děje a proč jen tohle:
 * 1. fáze zakázky → `cancelled` + `cancelled_at` (průběh žádosti ukazuje kdy);
 * 2. nezaplacené žádosti o platbu (záloha/doplatek) → `cancelled`, aby 30min
 *    záchranná úloha ani připomínka doplatku nechodily za zrušenou zakázkou;
 * 3. event `made-to-order.cancelled`.
 *
 * Co se tu NEDĚJE: nativní zrušení objednávky, merchantská fáze a peníze.
 * To rozhoduje volající — u čisté zakázky se objednávka ruší celá, u smíšené
 * zůstává (zakázková položka jde pryč úpravou objednávky) a s ponechanou
 * zálohou se nativně nesmí zrušit vůbec (`cancelOrderWorkflow` by zálohu sám
 * a potichu vrátil — pojistka §3).
 *
 * Idempotentní: už zrušená zakázka se nepřepisuje (zůstává první `cancelled_at`).
 */
export type CancelProductionStageInput = {
  productionOrder: { id: string; stage?: string | null; cancelled_at?: unknown }
  orderId: string
}

export const cancelProductionStage = async (
  scope: MedusaContainer,
  { productionOrder, orderId }: CancelProductionStageInput
): Promise<any> => {
  const madeToOrder = scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const now = new Date()

  const updated = await madeToOrder.updateProductionOrders({
    id: productionOrder.id,
    stage: "cancelled",
    cancelled_at: productionOrder.cancelled_at
      ? new Date(productionOrder.cancelled_at as string)
      : now,
  } as never)

  const payments = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]
  for (const payment of payments) {
    if (payment.status === "paid" || payment.status === "cancelled") continue
    await madeToOrder.updateProductionPaymentRequests({
      id: payment.id,
      status: "cancelled",
    } as never)
  }

  await scope.resolve(Modules.EVENT_BUS).emit({
    name: "made-to-order.cancelled",
    data: { order_id: orderId, production_order_id: productionOrder.id },
  })

  return updated
}
