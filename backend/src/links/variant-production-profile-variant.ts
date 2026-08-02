import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import MadeToOrderModule from "../modules/made-to-order"

export default defineLink(
  {
    linkable: MadeToOrderModule.linkable.variantProductionProfile.id,
    field: "variant_id",
  },
  ProductModule.linkable.productVariant,
  { readOnly: true }
)
