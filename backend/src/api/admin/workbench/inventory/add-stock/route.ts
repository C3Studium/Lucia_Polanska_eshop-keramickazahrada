import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  addStockToItem,
  removeStockFromItem,
  resolveRestockLocation,
  withStockLock,
} from "../../../../../lib/add-stock"

/*
 * Změna počtu kusů u výrobku. Kladné číslo přidá (po výpalu), záporné
 * odebere (18. 11. 2026, Lucie: „sklad potřebuji změnit ze 2 na 0, ale jde
 * jen přidat"). Odebrat nejde pod kusy rezervované otevřenými objednávkami —
 * odpověď vrací, kolik se skutečně odebralo.
 */
const BodySchema = z.object({
  inventory_item_id: z.string().min(1),
  quantity: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = BodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Napište prosím, kolik kusů přidat (např. 3), nebo odebrat (např. -2)."
    )
  }
  const { inventory_item_id, quantity } = parsed.data

  const inventory = req.scope.resolve(Modules.INVENTORY) as any

  // Jedna logika v lib/add-stock.ts (jedno skladové místo, chybějící úroveň
  // se při přidání založí); přičítání i odebírání jdou za sebou ve frontě.
  const result = await withStockLock(async () => {
    const locationId = await resolveRestockLocation(req.scope)
    if (quantity > 0) {
      const added = await addStockToItem(inventory, locationId, inventory_item_id, quantity)
      return { locationId, stocked_quantity: added.stocked_quantity, added: quantity, removed: 0, reserved: added.reserved }
    }
    const removed = await removeStockFromItem(inventory, locationId, inventory_item_id, quantity)
    return {
      locationId,
      stocked_quantity: removed.stocked_quantity,
      added: 0,
      removed: removed.removed,
      reserved: removed.reserved,
    }
  })

  res.status(200).json({
    inventory_item_id,
    location_id: result.locationId,
    added: result.added,
    removed: result.removed,
    reserved: result.reserved,
    stocked_quantity: result.stocked_quantity,
  })
}
