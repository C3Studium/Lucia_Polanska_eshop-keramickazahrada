import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { z } from "@medusajs/framework/zod";
import { AdminCreateProduct } from "@medusajs/medusa/api/admin/products/validators";
import {
  createBundledProductWorkflow,
  CreateBundledProductWorkflowInput,
} from "../../../workflows/create-bundled-product";

export const PostBundledProductsSchema = z.object({
  title: z.string().min(1),
  pricing_mode: z.enum(["component_sum", "component_sum_discount", "fixed_price"]).default("component_sum"),
  discount_percentage: z.number().gt(0).lt(100).nullable().optional(),
  product: AdminCreateProduct(),
  items: z.array(
    z.object({
      product_id: z.string(),
      quantity: z.number().int().positive(),
      display_order: z.number().int().nonnegative().optional(),
      variant_mode: z.enum(["customer_selects", "fixed_variant"]).default("customer_selects"),
      fixed_variant_id: z.string().nullable().optional(),
      // Kept as an alias for the first Admin bundle editor.
      variant_id: z.string().nullable().optional(),
    })
  ).min(1),
}).superRefine((value, ctx) => {
  if (value.pricing_mode === "component_sum_discount" && !value.discount_percentage) {
    ctx.addIssue({
      code: "custom",
      path: ["discount_percentage"],
      message: "discount_percentage is required for component_sum_discount",
    })
  }
  value.items.forEach((item, index) => {
    if (item.variant_mode === "fixed_variant" && !(item.fixed_variant_id || item.variant_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "fixed_variant_id"],
        message: "A fixed bundle item requires a variant",
      })
    }
  })
});

type PostBundledProductsSchema = z.infer<typeof PostBundledProductsSchema>;

export async function POST(
  req: AuthenticatedMedusaRequest<PostBundledProductsSchema>,
  res: MedusaResponse
) {
  const payload = req.validatedBody || req.body;
  const workflowPayload = {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      fixed_variant_id: item.fixed_variant_id || item.variant_id || null,
    })),
  }
  const { result: bundledProduct } = await createBundledProductWorkflow(
    req.scope
  ).run({
    input: {
      bundle: workflowPayload,
    } as CreateBundledProductWorkflowInput,
  });

  res.status(201).json({
    bundled_product: bundledProduct,
  });
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query");
  const limit = Number(
    (req.query as any)?.limit ?? (req.query as any)?.take ?? 15
  );
  const offset = Number(
    (req.query as any)?.offset ?? (req.query as any)?.skip ?? 0
  );

  const { data: bundledProducts, metadata: { count, take, skip } = {} } =
    await query.graph({
      entity: "bundle",
      fields: [
        "*",
        "product.*",
        "product.images.*",
        "items.*",
        "items.product.*",
        "items.product_variant.*",
      ],
      pagination: {
        take: limit,
        skip: offset,
      },
    });

  res.json({
    bundled_products: bundledProducts,
    count: count || 0,
    limit: take || limit,
    offset: skip || offset,
  });
}
