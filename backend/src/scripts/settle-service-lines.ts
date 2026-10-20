import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  OUTSTANDING_ITEM_FIELDS,
  serviceLinesOutstanding,
  shipmentItemsOf,
} from "../lib/parcel-tracking/shipment-items"
import { settleServiceLines } from "../lib/service-lines-settle"

/**
 * Jednorázově: balné a doběrečné u objednávek, které už odešly.
 *
 * Od opravy 16. 10. 2026 se servisní řádky zapisují samy po odeslání zboží
 * (`subscribers/settle-service-lines.ts`). Objednávky odeslané dřív zůstaly
 * v nativním záhlaví „Částečně splněno" s balným v Nesplněných položkách (#50).
 * Tenhle skript je dorovná stejnou cestou — jen zápis v modulu objednávek,
 * žádné plnění u dopravce, žádný e-mail.
 *
 *   npx medusa exec ./src/scripts/settle-service-lines.ts            # nasucho
 *   npx medusa exec ./src/scripts/settle-service-lines.ts --apply
 *
 * Bere jen objednávky, u kterých je VŠECHNO zboží odeslané (nic s dopravou
 * nezbývá) a nejsou zrušené. Rozpracované objednávky nechá být — ty dorovná
 * jejich vlastní odeslání.
 */
export default async function settleServiceLinesScript({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apply = args.includes("--apply")

  const PAGE = 100
  let offset = 0
  let candidates = 0
  let settled = 0

  for (;;) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "status", ...OUTSTANDING_ITEM_FIELDS],
      pagination: { skip: offset, take: PAGE, order: { created_at: "ASC" } },
    })
    if (!orders.length) break
    offset += orders.length

    for (const order of orders as any[]) {
      if (order.status === "canceled") continue
      const hasGoods = (order.items || []).some((item: any) => item?.requires_shipping)
      if (!hasGoods || shipmentItemsOf(order).length > 0) continue // zboží ještě neodešlo
      const { fulfill, ship } = serviceLinesOutstanding(order)
      if (!fulfill.length && !ship.length) continue

      candidates += 1
      const label = `#${order.display_id ?? order.id}`
      if (!apply) {
        logger.info(
          `[balné] ${label}: k zapsání ${fulfill.length} řádků jako vyskladněné, ${ship.length} jako odeslané (nasucho).`
        )
        continue
      }
      try {
        const result = await settleServiceLines(container, order.id)
        settled += 1
        logger.info(`[balné] ${label}: zapsáno — vyskladněno ${result.fulfilled}, odesláno ${result.shipped}.`)
      } catch (error) {
        logger.warn(`[balné] ${label}: nepodařilo se — ${(error as Error)?.message ?? String(error)}`)
      }
    }
    if (orders.length < PAGE) break
  }

  logger.info(
    apply
      ? `[balné] Hotovo: ${settled} z ${candidates} odeslaných objednávek dorovnáno.`
      : `[balné] Nasucho: ${candidates} odeslaných objednávek má nezapsané balné. Spusťte znovu s --apply.`
  )
}
