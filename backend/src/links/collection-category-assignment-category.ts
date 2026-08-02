import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import MerchantCatalogModule from "../modules/merchant-catalog"

export default defineLink(
  {
    linkable: MerchantCatalogModule.linkable.collectionCategoryAssignment.id,
    field: "category_id",
  },
  ProductModule.linkable.productCategory,
  { readOnly: true }
)
