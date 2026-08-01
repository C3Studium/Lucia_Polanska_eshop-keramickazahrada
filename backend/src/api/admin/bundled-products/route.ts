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
  title: z.string(),
  product: AdminCreateProduct(),
  items: z.array(
    z.object({
      product_id: z.string(),
      quantity: z.number(),
    })
  ),
});

type PostBundledProductsSchema = z.infer<typeof PostBundledProductsSchema>;

export async function POST(
  req: AuthenticatedMedusaRequest<PostBundledProductsSchema>,
  res: MedusaResponse
) {
  console.log("Creating bundled product with data (validatedBody):", req.body);
  const { result: bundledProduct } = await createBundledProductWorkflow(
    req.scope
  ).run({
    input: {
      bundle: req.body,
    } as CreateBundledProductWorkflowInput,
  });

  res.json({
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
      fields: ["*", "product.*", "items.*", "items.product.*"],
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
