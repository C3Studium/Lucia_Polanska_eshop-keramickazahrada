import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import MadeToOrderModule from "../modules/made-to-order"

export default defineLink(
  {
    linkable: MadeToOrderModule.linkable.productProductionProfile.id,
    field: "product_id",
  },
  ProductModule.linkable.product,
  { readOnly: true }
)
