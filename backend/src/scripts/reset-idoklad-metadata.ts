import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IDOKLAD_METADATA_KEYS } from "../modules/idoklad/types"

/**
 * Wipes the `idoklad_*` stamps off one order so its invoice can be issued
 * again — the never-twice rule reads them, and a test invoice that was
 * deleted in iDoklad leaves them behind.
 *
 * Delete the bad invoice in iDoklad FIRST; this only clears the shop's
 * memory of it.
 *
 * Run with:  npx medusa exec ./src/scripts/reset-idoklad-metadata.ts <order_id | #číslo>
 */
export default async function resetIdokladMetadata({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const target = (args?.[0] ?? "").trim()

  if (!target) {
    logger.error(
      "[idoklad-reset] Chybí objednávka: npx medusa exec ./src/scripts/reset-idoklad-metadata.ts <order_id | #číslo>"
    )
    return
  }

  const filters = target.startsWith("order_")
    ? { id: target }
    : { display_id: Number(target.replace(/^#/, "")) }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: filters as never,
  })
  const order = (orders as any[])[0]
  if (!order) {
    logger.error(`[idoklad-reset] Objednávka ${target} nebyla nalezena.`)
    return
  }

  const metadata = { ...((order.metadata ?? {}) as Record<string, unknown>) }
  const removed = Object.values(IDOKLAD_METADATA_KEYS).filter(
    (key) => key in metadata
  )
  for (const key of removed) {
    delete metadata[key]
  }

  if (!removed.length) {
    logger.info(
      `[idoklad-reset] Objednávka #${order.display_id} žádné iDoklad stopy nemá — není co mazat.`
    )
    return
  }

  await container
    .resolve(Modules.ORDER)
    .updateOrders([{ id: order.id, metadata }] as never)

  logger.info(
    `[idoklad-reset] Objednávka #${order.display_id}: smazáno ${removed.length} záznamů (${removed.join(", ")}). Fakturu teď lze vystavit znovu.`
  )
}
