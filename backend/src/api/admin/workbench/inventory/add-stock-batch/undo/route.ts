import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  restockBatches,
  revertRestockBatch,
  withStockLock,
} from "../../../../../../lib/add-stock"

/**
 * „Vrátit zpět" po naskladnění po výpalu.
 *
 * Vrací jen dávku, kterou tenhle server sám uložil (podle `request_id`), a
 * jen do deseti minut — odečte přesně přičtené kusy. Druhé kliknutí vrátí
 * stejný výsledek, neodečte podruhé. Pravidla jsou v `lib/add-stock.ts`.
 */
const BodySchema = z.object({
  request_id: z.string().min(8).max(100),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Nevím, které naskladnění vrátit — obnovte prosím stránku."
    )
  }
  const inventory = req.scope.resolve(Modules.INVENTORY) as any

  const result = await restockBatches.undo(parsed.data.request_id, (batch) =>
    withStockLock(() => revertRestockBatch(inventory, batch))
  )

  res.status(200).json(result)
}
