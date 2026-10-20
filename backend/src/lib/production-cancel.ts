import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import {
  cancellationPhaseOf,
  type CancellationPhase,
  type CancelledBy,
} from "./made-to-order/cancellation"

/**
 * Zrušení ZAKÁZKY na výrobní straně — JEDNA cesta pro „Zrušit zakázku" v
 * modulu zakázek (`made-to-order/orders/:id/actions` → `cancel`), pro
 * „Zrušit zakázku" ze žádosti v Reklamace a zrušení
 * (docs/reklamace-a-zruseni.md §12.4, `cancel-production`) i pro zrušení
 * zákazníkem / nezaplaceným doplatkem (LEGAL_AUDIT.md § 0, Z4–Z6;
 * lib/made-to-order/customer-cancel).
 *
 * Co se tu děje a proč jen tohle:
 * 1. fáze zakázky → `cancelled` + `cancelled_at` (průběh žádosti ukazuje kdy);
 *    k tomu KDO zrušil (`cancelled_by`), v jaké FÁZI (`cancellation_phase` —
 *    před/po e-mailu Z3, podle `production_start_notified_at`, ne podle
 *    tvrzení) a kolik se VRÁTILO (`cancellation_refund_amount`);
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
 * Idempotentní: už zrušená zakázka se nepřepisuje (zůstává první `cancelled_at`
 * i první `cancelled_by` / fáze).
 */
export type ProductionCancellationRecord = {
  cancelled_by: CancelledBy
  /** Vynechané = podle `production_start_notified_at` zakázky. */
  cancellation_phase?: CancellationPhase
  /** Kolik se zákazníkovi vrátilo (null = ještě neznámo / nic). */
  cancellation_refund_amount?: number | null
}

export type CancelProductionStageInput = {
  productionOrder: {
    id: string
    stage?: string | null
    cancelled_at?: unknown
    cancelled_by?: unknown
    cancellation_phase?: unknown
    production_start_notified_at?: unknown
  }
  orderId: string
  cancellation?: ProductionCancellationRecord | null
}

export const cancelProductionStage = async (
  scope: MedusaContainer,
  { productionOrder, orderId, cancellation }: CancelProductionStageInput
): Promise<any> => {
  const madeToOrder = scope.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const now = new Date()
  const alreadyCancelled = Boolean(productionOrder.cancelled_at)

  const updated = await madeToOrder.updateProductionOrders({
    id: productionOrder.id,
    stage: "cancelled",
    cancelled_at: alreadyCancelled
      ? new Date(productionOrder.cancelled_at as string)
      : now,
    // Záznam o zrušení jen u prvního zrušení; při opakování zůstává původní.
    ...(cancellation && !alreadyCancelled
      ? {
          cancelled_by: cancellation.cancelled_by,
          cancellation_phase:
            cancellation.cancellation_phase ??
            cancellationPhaseOf(productionOrder.production_start_notified_at),
          ...(cancellation.cancellation_refund_amount !== undefined
            ? { cancellation_refund_amount: cancellation.cancellation_refund_amount }
            : {}),
        }
      : {}),
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
