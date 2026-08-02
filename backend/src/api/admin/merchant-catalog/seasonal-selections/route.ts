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
  res.json({
    seasonal_selections: data,
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
