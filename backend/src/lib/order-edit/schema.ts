import { z } from "@medusajs/framework/zod"
import { MAX_ACTIONS, MAX_ADD_QUANTITY, MAX_SET_QUANTITY } from "../order-edit-rules"

/**
 * Tělo POST úpravy (docs/uprava-objednavky-plan.md §5). Meze tvaru hlídá
 * schéma, význam (zámky, prázdná objednávka, limit) `order-edit-rules`.
 */
export const EditBodySchema = z.object({
  token: z.unknown().optional(),
  dry_run: z.boolean().optional(),
  actions: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("swap"), item_id: z.string(), variant_id: z.string() }),
        z.object({ type: z.literal("remove"), item_id: z.string() }),
        z.object({
          type: z.literal("set_quantity"),
          item_id: z.string(),
          quantity: z.number().int().min(1).max(MAX_SET_QUANTITY),
        }),
        z.object({
          type: z.literal("add"),
          variant_id: z.string(),
          quantity: z.number().int().min(1).max(MAX_ADD_QUANTITY),
        }),
      ])
    )
    .min(1)
    .max(MAX_ACTIONS),
})
