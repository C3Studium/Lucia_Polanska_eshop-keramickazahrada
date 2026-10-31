import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { ORDER_DELAYS_KEY, announceOrderDelay } from "../../../../../lib/order-delay"

/**
 * Panel „Zpoždění objednávky" v detailu objednávky (`admin/widgets/order-delay.tsx`).
 *
 * GET — historie oznámených zpoždění.
 * POST `{ item_ids, new_date: "RRRR-MM-DD", reason? }` — oznámí zpoždění:
 * e-mail zákazníkovi se seznamem výrobků + posun termínu zakázek mezi nimi
 * (`lib/order-delay.ts`).
 */
const Body = z.object({
  item_ids: z.array(z.string().min(1)).min(1, { message: "Vyberte aspoň jeden výrobek." }),
  /* Kolik kusů z řádku se zdrží (id → počet); co chybí, je celý řádek. */
  item_quantities: z.record(z.string(), z.number().int().min(1).max(999)).optional(),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Nový termín zadejte jako datum." }),
  reason: z.string().trim().max(500).optional().nullable(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: req.params.id } })
  const metadata = ((data?.[0] as any)?.metadata ?? {}) as Record<string, unknown>
  res.json({ delays: Array.isArray(metadata[ORDER_DELAYS_KEY]) ? metadata[ORDER_DELAYS_KEY] : [] })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = Body.safeParse(req.body ?? {})
  if (!parsed.success) {
    const m = parsed.error.issues[0]?.message ?? ""
    res.status(400).json({ message: /[áčďéěíňóřšťúůýž]/i.test(m) ? m : "Zkontrolujte prosím vyplněné údaje." })
    return
  }
  try {
    const result = await announceOrderDelay(req.scope, {
      orderId: req.params.id,
      itemIds: parsed.data.item_ids,
      itemQuantities: parsed.data.item_quantities ?? null,
      newDate: parsed.data.new_date,
      reason: parsed.data.reason ?? null,
    })
    res.json(result)
  } catch (error) {
    if (error instanceof MedusaError) {
      res.status(error.type === MedusaError.Types.NOT_FOUND ? 404 : 400).json({ message: error.message })
      return
    }
    throw error
  }
}
