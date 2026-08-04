import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { createSeasonalSelectionWorkflow } from "../../../../workflows/manage-seasonal-selection"

export const SeasonalSelectionItemSchema = z.object({
  product_id: z.string().min(1),
  display_order: z.number().int().nonnegative().optional(),
})

export const PostSeasonalSelectionSchema = z.object({
  title: z.string().min(1),
  handle: z.string().min(1),
  description: z.string().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  mobile_image_url: z.string().url().nullable().optional(),
  publication_status: z.enum(["draft", "published", "archived"]).default("draft"),
  starts_at: z.coerce.date().nullable().optional(),
  ends_at: z.coerce.date().nullable().optional(),
  linked_price_list_id: z.string().nullable().optional(),
  on_end: z.enum(["keep_selling", "hide_products"]).optional(),
  items: z.array(SeasonalSelectionItemSchema).default([]),
})

export const GetSeasonalSelectionsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  publication_status: z.enum(["draft", "published", "archived"]).optional(),
})

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = ((req as any).validatedQuery ?? req.query) as z.infer<
    typeof GetSeasonalSelectionsSchema
  >
  const query = req.scope.resolve("query")
  const { data, metadata } = await query.graph({
    entity: "seasonal_selection",
    fields: ["*", "items.*", "items.product.*", "price_list.*"],
    filters: input.publication_status
      ? { publication_status: input.publication_status }
      : {},
    pagination: { take: input.limit, skip: input.offset },
  })

  // Which of these products are bundles.
  //
  // A bundle is a real product with a `bundle` record linked to it, so nothing
  // distinguishes it in the product row itself — but the merchant needs to know,
  // because putting a bundle in a sale also discounts everything inside it. The
  // link is defined from the bundle side, which is the only direction it can be
  // traversed (`src/links/bundle-product.ts`).
  const productIds = (data as any[]).flatMap((selection) =>
    (selection.items || []).map((item: any) => item.product_id)
  )

  const { data: bundles } = productIds.length
    ? await query.graph({
        entity: "bundle",
        fields: ["id", "title", "product.id"],
      })
    : { data: [] as any[] }

  const bundleByProductId = new Map<string, { id: string; title: string }>()
  for (const bundle of bundles as any[]) {
    for (const product of [bundle.product].flat().filter(Boolean)) {
      bundleByProductId.set(product.id, { id: bundle.id, title: bundle.title })
    }
  }

  const annotated = (data as any[]).map((selection) => ({
    ...selection,
    items: (selection.items || [])
      .map((item: any) => ({
        ...item,
        bundle: bundleByProductId.get(item.product_id) ?? null,
      }))
      .sort(
        (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
      ),
  }))

  res.json({
    seasonal_selections: annotated,
    count: metadata?.count ?? data.length,
    limit: metadata?.take ?? input.limit,
    offset: metadata?.skip ?? input.offset,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<z.infer<typeof PostSeasonalSelectionSchema>>,
  res: MedusaResponse
) {
  const { result } = await createSeasonalSelectionWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "seasonal_selection",
    fields: ["*", "items.*", "items.product.*", "price_list.*"],
    filters: { id: result.id },
  })
  res.status(201).json({ seasonal_selection: data[0] })
}
