import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  resolveRestockLocation,
  restockBatches,
  runRestockBatch,
  withStockLock,
} from "../../../../../lib/add-stock"

/**
 * Naskladnění po výpalu — víc položek jedním tlačítkem.
 *
 * Stejné přičítání jako `../add-stock` (sdílené v `lib/add-stock.ts`), jen po
 * jedné položce s výsledkem u každé. `request_id` vymyslí prohlížeč pro
 * jednu vyplněnou dávku: dvojklik nebo opakování po výpadku sítě vrátí
 * výsledek první várky, kusy se nepřičtou dvakrát.
 */
const BodySchema = z.object({
  request_id: z.string().min(8).max(100),
  items: z
    .array(
      z.object({
        inventory_item_id: z.string().min(1),
        quantity: z.number().int().min(1).max(100_000),
      })
    )
    .min(1)
    .max(300),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Napište prosím u každé položky celý počet kusů, které přibyly."
    )
  }
  const { request_id, items } = parsed.data
  const inventory = req.scope.resolve(Modules.INVENTORY) as any

  const result = await restockBatches.submit(request_id, items, (merged) =>
    withStockLock(async () => {
      const locationId = await resolveRestockLocation(req.scope)
      return runRestockBatch(inventory, locationId, request_id, merged)
    })
  )

  res.status(200).json(result)
}
