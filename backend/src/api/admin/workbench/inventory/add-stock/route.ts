import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  addStockToItem,
  resolveRestockLocation,
  withStockLock,
} from "../../../../../lib/add-stock"

/**
 * Additive restock that works even for never-stocked items
 * (Matěj, 2026-08-06: a fresh Vyprodáno variant has no location level, the
 * inline field disabled itself, and she was sent on the five-click native
 * trek — with exactly one workshop location, absurd).
 *
 * The rule: she says HOW MANY came out of the kiln; everything else is the
 * backend's problem. One stock location → used automatically, the level
 * created if it never existed. If a second location ever appears, this
 * route refuses politely rather than guessing where six mugs went.
 */
const BodySchema = z.object({
  inventory_item_id: z.string().min(1),
  quantity: z.number().int().min(1).max(100_000),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Napište prosím, kolik kusů přibylo."
    )
  }
  const { inventory_item_id, quantity } = parsed.data

  const inventory = req.scope.resolve(Modules.INVENTORY) as any

  // Stejné přičítání jako dávka po výpalu — jedna logika v lib/add-stock.ts
  // (jedno skladové místo, chybějící úroveň se založí).
  const { locationId, stocked_quantity } = await withStockLock(async () => {
    const locationId = await resolveRestockLocation(req.scope)
    const added = await addStockToItem(inventory, locationId, inventory_item_id, quantity)
    return { locationId, stocked_quantity: added.stocked_quantity }
  })

  res.status(200).json({
    inventory_item_id,
    location_id: locationId,
    added: quantity,
    stocked_quantity,
  })
}
