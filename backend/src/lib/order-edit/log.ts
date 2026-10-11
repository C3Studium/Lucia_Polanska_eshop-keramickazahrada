import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Záznam zákaznických úprav na objednávce (`metadata.customer_edits`) — pro
 * Objednávky+ („Zákazník upravil 2× · −240 Kč"). Limit úprav se počítá
 * z order_change (zdroj pravdy), tohle je jen čitelná stopa.
 *
 * Metadata se při update slučují: zapisuje se jen tenhle klíč (celé pole),
 * ostatní metadata objednávky zůstanou.
 */
export type CustomerEditEntry = {
  at: string
  change_id: string
  difference: number
  payment: string
  settlement: string
}

export const customerEditsOf = (metadata: unknown): CustomerEditEntry[] => {
  const list = (metadata as Record<string, unknown> | null)?.customer_edits
  return Array.isArray(list)
    ? (list.filter((entry) => entry && typeof entry === "object") as CustomerEditEntry[])
    : []
}

export const recordCustomerEdit = async (
  container: MedusaContainer,
  orderId: string,
  entry: Omit<CustomerEditEntry, "at">
): Promise<void> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: orderId },
  })
  const current = customerEditsOf((data as any[])[0]?.metadata)
  // Idempotence: zaplacená úprava se potvrzuje z webhooku, který může přijít
  // víckrát — stejná změna se zapíše jen jednou.
  if (current.some((existing) => existing.change_id === entry.change_id)) {
    return
  }
  const next = [...current, { ...entry, at: new Date().toISOString() }].slice(-20)
  await (container.resolve(Modules.ORDER) as any).updateOrders([
    { id: orderId, metadata: { customer_edits: next } },
  ])
}
