import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product";
import BundledProductModuleService from "../../modules/bundled-product/service";

/**
 * Keep the bundle workspace title aligned when its linked catalog product is
 * edited from Medusa's standard product page.
 */
updateProductsWorkflow.hooks.productsUpdated(
  async ({ products }, { container }) => {
    const productIds = products.map((product) => product.id).filter(Boolean);
    if (!productIds.length) return;

    const query = container.resolve("query");
    const bundleService = container.resolve<BundledProductModuleService>(
      BUNDLED_PRODUCT_MODULE
    );
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "bundle.id"],
      filters: { id: productIds },
    });

    const updates = data.flatMap((product: any) =>
      product.bundle?.id && product.title
        ? [{ id: product.bundle.id, title: product.title }]
        : []
    );

    if (updates.length) {
      await bundleService.updateBundles(updates);
    }
  }
);
