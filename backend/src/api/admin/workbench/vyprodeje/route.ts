import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createVyprodej, loadVyprodeje, vyprodejMembersPreview } from "../../../../lib/vyprodej"
import { datesOk, VyprodejBody } from "./schema"

/**
 * Slevy → Výprodeje (18. 11. 2026). Jádro a pravidla viz `lib/vyprodej.ts`.
 * GET seznam se jmény rozsahu a ukázkou výrobků, POST založí výprodej.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const vyprodeje = await loadVyprodeje(req.scope)
  const [{ data: collections }, { data: categories }] = await Promise.all([
    query.graph({ entity: "product_collection", fields: ["id", "title"], pagination: { take: 500, skip: 0 } }),
    query.graph({ entity: "product_category", fields: ["id", "name"], pagination: { take: 1000, skip: 0 } }),
  ])
  const collectionTitle = new Map((collections as any[]).map((item) => [item.id, item.title]))
  const categoryName = new Map((categories as any[]).map((item) => [item.id, item.name]))

  const rows = await Promise.all(
    vyprodeje.map(async (vyprodej) => {
      const explicit = await vyprodejMembersPreview(req.scope, vyprodej.config.product_ids)
      return {
        id: vyprodej.id,
        title: vyprodej.title,
        status: vyprodej.status,
        state: vyprodej.state,
        type: vyprodej.config.type,
        percent: vyprodej.config.percent,
        starts_at: vyprodej.starts_at,
        ends_at: vyprodej.ends_at,
        created_at: vyprodej.created_at,
        collections: vyprodej.config.collection_ids.map((id) => ({ id, title: collectionTitle.get(id) ?? "?" })),
        categories: vyprodej.config.category_ids.map((id) => ({ id, name: categoryName.get(id) ?? "?" })),
        products: explicit,
        excluded_count: vyprodej.config.excluded_product_ids.length,
        members_count: vyprodej.config.members.length,
        members: await vyprodejMembersPreview(req.scope, vyprodej.config.members.slice(0, 6)),
      }
    })
  )
  const order = { running: 0, scheduled: 1, off: 2, ended: 3 } as const
  rows.sort((a, b) => order[a.state] - order[b.state] || String(b.created_at).localeCompare(String(a.created_at)))
  res.status(200).json({ vyprodeje: rows })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = VyprodejBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.issues[0]?.message ?? "Neplatný výprodej.")
  }
  const body = parsed.data
  if (!datesOk(body)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Konec výprodeje musí být po jeho začátku.")
  }
  if (!body.collection_ids.length && !body.category_ids.length && !body.product_ids.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Vyberte kolekci, kategorii nebo výrobky.")
  }
  const vyprodej = await createVyprodej(req.scope, body)
  res.status(201).json({ vyprodej })
}
