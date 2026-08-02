import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import MerchantCatalogModule from "../modules/merchant-catalog"

export default defineLink(
  {
    linkable: MerchantCatalogModule.linkable.collectionProfile.id,
    field: "collection_id",
  },
  ProductModule.linkable.productCollection,
  { readOnly: true }
)
