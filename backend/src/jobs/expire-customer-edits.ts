import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelBeginOrderEditWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Nezaplacené zákaznické úpravy nesmí objednávku zamknout navždy.
 *
 * Medusa drží jednu aktivní změnu na objednávku; karta+dráž čeká na
 * zaplacení. Kdo nezaplatí do 24 h, tomu změna vyprší — objednávka se
 * odemkne a platí původní stav. Ruší se JEN změny s naším markerem
 * customer_edit; adminské rozpracované edity necháváme být.
 */
export default async function expireCustomerEdits(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve("logger")
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: changes } = await query
    .graph({
      entity: "order_change",
      fields: ["id", "order_id", "status", "created_at", "metadata"],
      filters: { status: "pending" } as never,
      pagination: { take: 200, skip: 0 },
    })
    .catch(() => ({ data: [] as any[] }))

  for (const change of changes as any[]) {
    if (!(change.metadata as any)?.customer_edit) continue
    if (String(change.created_at) > dayAgo) continue
    try {
      await cancelBeginOrderEditWorkflow(container).run({
        input: { order_id: change.order_id } as never,
      })
      logger.info(`[order-edit] Vypršela nezaplacená úprava ${change.id}.`)
    } catch {
      // Mezitím potvrzena/zrušena — v pořádku.
    }
  }
}

export const config = {
  name: "expire-customer-edits",
  schedule: "15 * * * *",
}
