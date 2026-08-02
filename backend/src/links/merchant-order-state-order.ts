import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import MerchantOrderModule from "../modules/merchant-order"

export default defineLink(
  {
    linkable: MerchantOrderModule.linkable.merchantOrderState.id,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
)
