import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import MadeToOrderModule from "../modules/made-to-order"

export default defineLink(
  {
    linkable: MadeToOrderModule.linkable.productionOrder.id,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
)
