import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelBeginOrderEditWorkflow } from "@medusajs/medusa/core-flows"
import { CUSTOMER_EDIT_DESCRIPTION, DRY_RUN_NOTE } from "../lib/order-edit/core"
import { cancelEditPaymentCollections } from "../lib/order-edit/payments"

/**
 * Nezaplacené zákaznické úpravy nesmí objednávku zamknout navždy.
 *
 * Medusa drží jednu aktivní změnu na objednávku; karta+dráž čeká na
 * zaplacení. Kdo nezaplatí do 24 h, tomu změna vyprší — objednávka se
 * odemkne, platí původní stav a smaže se i nezaplacená kolekce doplatku.
 * Zbytek po spadlém náhledu (`dry_run`) se uklidí po 10 minutách.
 *
 * Ruší se JEN změny se značkou zákaznické úpravy (`description`, viz
 * lib/order-edit/core.ts — metadata Medusa u úpravy neukládá, dřívější
 * značka v metadatech proto nikdy nic nenašla); adminské edity nechává být.
 */
export default async function expireCustomerEdits(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve("logger")
  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString()

  const { data: changes } = await query
    .graph({
      entity: "order_change",
      fields: ["id", "order_id", "status", "created_at", "description", "internal_note"],
      filters: { status: ["pending", "requested"] } as never,
      pagination: { take: 200, skip: 0 },
    })
    .catch(() => ({ data: [] as any[] }))

  for (const change of changes as any[]) {
    if (change.description !== CUSTOMER_EDIT_DESCRIPTION) continue
    const created = new Date(change.created_at).toISOString()
    const dryRun = change.internal_note === DRY_RUN_NOTE
    if (created > (dryRun ? tenMinutesAgo : dayAgo)) continue
    try {
      await cancelBeginOrderEditWorkflow(container).run({
        input: { order_id: change.order_id } as never,
      })
      if (!dryRun) {
        await cancelEditPaymentCollections(container, change.order_id, change.id).catch(() => 0)
      }
      logger.info(
        `[order-edit] ${dryRun ? "Uklizen zbytek náhledu" : "Vypršela nezaplacená úprava"} ${change.id}.`
      )
    } catch {
      // Mezitím potvrzena/zrušena — v pořádku.
    }
  }
}

export const config = {
  name: "expire-customer-edits",
  schedule: "15 * * * *",
}
