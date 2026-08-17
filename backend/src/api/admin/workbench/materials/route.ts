import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Every material the catalogue already uses — the product page's select
 * (2026-08-16).
 *
 * There is no separate materials table to maintain: the list IS the distinct
 * `material` values on products. Adding a new one happens by typing it on any
 * product; from then on it is offered everywhere. A typo dies out the same
 * way — retype it on the pieces that carry it and it disappears from the
 * offer. Self-maintaining beats a second admin screen.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["material"],
    pagination: { take: 2000, skip: 0 },
  })

  const materials = [
    ...new Set(
      (products as { material?: string | null }[])
        .map((product) => product.material?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ].sort((a, b) => a.localeCompare(b, "cs"))

  res.status(200).json({ materials })
}
