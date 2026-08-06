import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

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

  const stockLocations = req.scope.resolve(Modules.STOCK_LOCATION) as any
  const inventory = req.scope.resolve(Modules.INVENTORY) as any

  const locations = (await stockLocations.listStockLocations({}, {
    take: 5,
  })) as any[]
  if (!locations.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Obchod nemá žádné skladové místo — založte ho v Nastavení → Místa a doprava."
    )
  }
  if (locations.length > 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Máte víc skladových míst — doplňte kusy ve skladu, ať skončí na tom správném."
    )
  }
  const locationId = locations[0].id

  const [level] = (await inventory.listInventoryLevels({
    inventory_item_id,
    location_id: locationId,
  })) as any[]

  if (level) {
    await inventory.updateInventoryLevels([
      {
        inventory_item_id,
        location_id: locationId,
        stocked_quantity: Number(level.stocked_quantity ?? 0) + quantity,
      },
    ])
  } else {
    // The five-click case, deleted: first stock of a new piece just works.
    await inventory.createInventoryLevels([
      {
        inventory_item_id,
        location_id: locationId,
        stocked_quantity: quantity,
      },
    ])
  }

  res.status(200).json({
    inventory_item_id,
    location_id: locationId,
    added: quantity,
    stocked_quantity: Number(level?.stocked_quantity ?? 0) + quantity,
  })
}
