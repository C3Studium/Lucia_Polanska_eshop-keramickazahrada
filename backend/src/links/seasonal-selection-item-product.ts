import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import MerchantCatalogModule from "../modules/merchant-catalog"

export default defineLink(
  {
    linkable: MerchantCatalogModule.linkable.seasonalSelectionItem.id,
    field: "product_id",
  },
  ProductModule.linkable.product,
  { readOnly: true }
)
