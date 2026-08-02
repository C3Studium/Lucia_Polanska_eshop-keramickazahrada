import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { AdminUpdateProduct } from "@medusajs/medusa/api/admin/products/validators"
import { updateBundledProductWorkflow } from "../../../../workflows/update-bundled-product"
import { deleteBundledProductWorkflow } from "../../../../workflows/delete-bundled-product"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const { id } = req.params

  const { data } = await query.graph({
    entity: "bundle",
    fields: [
      "*",
      "items.*",
      "items.product.*",
      "items.product_variant.*",
      "product.*",
      "product.images.*",
    ],
    filters: {
      id,
    },
  })

  res.json({
    bundled_product: data?.[0] ?? null,
  })
}

export const PatchBundledProductsSchema = z.object({
  title: z.string().min(1).optional(),
  pricing_mode: z.enum(["component_sum", "component_sum_discount", "fixed_price"]).optional(),
  discount_percentage: z.number().gt(0).lt(100).nullable().optional(),
  product: AdminUpdateProduct().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string(),
        quantity: z.number().int().positive(),
        display_order: z.number().int().nonnegative().optional(),
        variant_mode: z.enum(["customer_selects", "fixed_variant"]).default("customer_selects"),
        fixed_variant_id: z.string().nullable().optional(),
        variant_id: z.string().nullable().optional(),
      })
    )
    .optional(),
})

type PatchBundledProductsSchema = z.infer<typeof PatchBundledProductsSchema>

export async function PATCH(
  req: AuthenticatedMedusaRequest<PatchBundledProductsSchema>,
  res: MedusaResponse
) {
  const payload = req.validatedBody || req.body
  const { result } = await updateBundledProductWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      ...payload,
      title: payload.title ?? (
        typeof payload.product?.title === "string" ? payload.product.title : undefined
      ),
      items: payload.items?.map((item) => ({
        ...item,
        fixed_variant_id: item.fixed_variant_id || item.variant_id || null,
      })),
    },
  })

  return res.json({ bundled_product: result })
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await deleteBundledProductWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  return res.json({ ...result, object: "bundled_product" })
}
