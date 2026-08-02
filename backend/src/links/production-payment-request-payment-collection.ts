import { defineLink } from "@medusajs/framework/utils"
import PaymentModule from "@medusajs/medusa/payment"
import MadeToOrderModule from "../modules/made-to-order"

export default defineLink(
  {
    linkable: MadeToOrderModule.linkable.productionPaymentRequest.id,
    field: "payment_collection_id",
  },
  PaymentModule.linkable.paymentCollection,
  { readOnly: true }
)
