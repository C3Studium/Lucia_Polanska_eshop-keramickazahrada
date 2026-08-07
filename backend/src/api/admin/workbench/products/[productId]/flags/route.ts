import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

/**
 * The one place a product's workbench flags are written.
 *
 * ## Why this exists
 *
 * `POST /admin/products/:id` **replaces** `metadata` rather than merging it, and by 2026-08-07
 * four separate controls were each writing their own key straight to it — clearance, dobírka,
 * křehké and the packaging price. Every one of them silently erased the other three. Marking a
 * piece fragile un-marked it for dobírka; pricing its packaging in Balení+ made it not fragile
 * again. Nothing errored, and the damage was invisible until checkout behaved wrongly.
 *
 * So every one of those controls now comes here instead. This route reads what is stored,
 * applies only the keys it was given, and writes the whole object back — the read-modify-write
 * that each caller was skipping.
 *
 * ## Why the keys are a fixed list
 *
 * Product metadata is shared with anything else that wants to hang a value off a product. An
 * endpoint that merged arbitrary keys would let a typo introduce a field nothing reads and
 * nothing cleans up, and it would let this route quietly become the place where *any* product
 * data is written. It accepts these four because these four are what the workbench owns.
 *
 * Not concurrency-safe against simultaneous edits to *different* keys of the same product —
 * two people saving different flags on the same piece in the same second could lose one. She
 * is the only user of this admin, so the cost of a transaction here is not worth it; noting it
 * rather than pretending otherwise.
 */

const PatchFlagsSchema = z
  .object({
    /** Damaged-clearance piece — decides the Poškozené tab. */
    clearance: z.boolean().optional(),
    /** May the carrier collect cash for this piece. */
    cod_allowed: z.boolean().optional(),
    /** Forces the whole basket onto fragile carriage. */
    fragile: z.boolean().optional(),
    /**
     * What wrapping this piece costs, in CZK. `null` clears it back to the shop
     * default — distinct from "leave unchanged", which is omitting the key.
     */
    packaging_price: z.number().min(0).nullable().optional(),
    /**
     * Archived: kept in the database, gone from the shop and from the working
     * lists. Deliberately not a delete — an archived product still owns its
     * order history, and deleting it would take that with it.
     */
    archived: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Neposlali jste žádnou změnu.",
  })

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PatchFlagsSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Neplatná změna."
    )
  }

  const productModule = req.scope.resolve(Modules.PRODUCT)
  const [product] = await productModule.listProducts(
    { id: req.params.productId } as never,
    { take: 1, select: ["id", "metadata"] as never }
  )

  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Produkt nebyl nalezen.")
  }

  // Read, merge, write — the step each caller used to skip.
  const metadata = {
    ...((product as any).metadata ?? {}),
    ...parsed.data,
  }

  await productModule.updateProducts(req.params.productId, {
    metadata,
  } as never)

  res.status(200).json({
    id: req.params.productId,
    metadata,
  })
}
