import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  redeemVouchersFromOrder,
  reverseVouchersForCanceledOrder,
  syncPurchasedVouchers,
} from "../lib/gift-voucher-orders"

/**
 * Objednávky a dárkové poukazy (`lib/gift-voucher-orders.ts`):
 * - `order.placed` — odečíst poukazy uplatněné kódem v košíku; založit
 *   poukazy koupené jako výrobek (a je-li už zaplaceno, rovnou je vydat),
 * - `order.canceled` — vrátit uplatněné částky, zrušit koupené poukazy.
 * Zaplacení objednávky později (převod, dobírka) řeší `gift-voucher-payment`.
 */
export default async function giftVoucherOrdersHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data?.id
  if (!orderId) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    if (name === "order.canceled") {
      await reverseVouchersForCanceledOrder(container, orderId)
      return
    }
    await redeemVouchersFromOrder(container, orderId)
    await syncPurchasedVouchers(container, orderId)
  } catch (error) {
    logger.error(`[poukazy] ${name} ${orderId}: ${(error as Error)?.message ?? error}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}
