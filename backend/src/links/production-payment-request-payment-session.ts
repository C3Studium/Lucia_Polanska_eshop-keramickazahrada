import { defineLink } from "@medusajs/framework/utils"
import PaymentModule from "@medusajs/medusa/payment"
import MadeToOrderModule from "../modules/made-to-order"

export default defineLink(
  {
    linkable: MadeToOrderModule.linkable.productionPaymentRequest.id,
    field: "payment_session_id",
  },
  PaymentModule.linkable.paymentSession,
  { readOnly: true }
)
