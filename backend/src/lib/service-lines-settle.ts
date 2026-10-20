import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  OUTSTANDING_ITEM_FIELDS,
  serviceLinesOutstanding,
} from "./parcel-tracking/shipment-items"

/**
 * Servisní řádky (balné, doběrečné) jako vyskladněné a odeslané — BEZ plnění
 * u dopravce.
 *
 * ## Proč ne přes plnění (fulfillment)
 *
 * Balné není krabice, je to poplatek. Do plnění s výrobky ho Medusa nepustí
 * (jedno plnění buď celé s dopravou, nebo celé bez ní) a samostatné plnění by
 * šlo přes stejného providera: Medusa volá `createFulfillment` dopravce
 * u KAŽDÉHO plnění, takže by Česká pošta dostala druhé podání (druhý balík,
 * druhý poplatek). A druhé „odeslání" by spustilo `shipment.created` — e-mail
 * zákazníkovi u osobního odběru, sledování zásilky, fakturu.
 *
 * Modul objednávek umí totéž zapsat přímo (`registerFulfillment`,
 * `registerShipment`): posune `detail.fulfilled_quantity` a
 * `detail.shipped_quantity` řádků, nativní záhlaví pak ukáže „Odesláno" místo
 * „Částečně splněno", a nic dalšího se nestane — žádný provider, žádná
 * událost zásilky, žádný e-mail.
 *
 * ## Kdy
 *
 * Po skutečném odeslání zboží (`shipment.created`, viz
 * `subscribers/settle-service-lines.ts`). Dřív ne: štítek bez odeslání nechá
 * objednávku „K odeslání" a balné se zapíše až s krabicí.
 *
 * Idempotentní — zapisuje jen to, co ještě zbývá. Zrušenou objednávku nechá být.
 */

/** `reference` záznamu v historii objednávky — ať je vidět, odkud zápis je. */
export const SERVICE_LINE_REFERENCE = "service_line"

export type SettleResult = { fulfilled: number; shipped: number }

export const settleServiceLines = async (
  container: { resolve: (key: string) => any },
  orderId: string
): Promise<SettleResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", ...OUTSTANDING_ITEM_FIELDS],
    filters: { id: orderId },
  })
  const order = (data as any[])[0]
  if (!order || order.status === "canceled") return { fulfilled: 0, shipped: 0 }

  const { fulfill, ship } = serviceLinesOutstanding(order)
  if (!fulfill.length && !ship.length) return { fulfilled: 0, shipped: 0 }

  const orderModule = container.resolve(Modules.ORDER)

  // Nejdřív vyskladnit, pak odeslat — odeslat jde jen vyskladněné.
  if (fulfill.length) {
    await orderModule.registerFulfillment({
      order_id: orderId,
      reference: SERVICE_LINE_REFERENCE,
      reference_id: orderId,
      description: "Balné / doběrečné — zapsáno spolu s odesláním zboží",
      items: fulfill,
    })
  }
  if (ship.length) {
    await orderModule.registerShipment({
      order_id: orderId,
      reference: SERVICE_LINE_REFERENCE,
      reference_id: orderId,
      description: "Balné / doběrečné — zapsáno spolu s odesláním zboží",
      items: ship,
      no_notification: true,
    })
  }

  return {
    fulfilled: fulfill.reduce((sum, item) => sum + item.quantity, 0),
    shipped: ship.reduce((sum, item) => sum + item.quantity, 0),
  }
}
