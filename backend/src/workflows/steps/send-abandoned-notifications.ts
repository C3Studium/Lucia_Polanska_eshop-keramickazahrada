import { 
  createStep,
  StepResponse 
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { CartDTO, CustomerDTO } from "@medusajs/framework/types"
import { EmailTemplates } from "../../modules/resend/service"

type SendAbandonedNotificationsStepInput = {
  carts: (CartDTO & {
    customer?: CustomerDTO
  })[]
}

export const sendAbandonedNotificationsStep = createStep(
  "send-abandoned-notifications",
  async (input: SendAbandonedNotificationsStepInput, { container }) => {
    const notificationModuleService = container.resolve(
      Modules.NOTIFICATION
    )

    // One nudge per cart, ever. The cart's own `abandoned_notification` metadata
    // flag is only set after this step succeeds, so a failed send leaves the
    // cart eligible again tomorrow — the key makes that a retry of the same
    // e-mail instead of a second one.
    const notificationData = input.carts.map((cart) => ({
      to: cart.email!,
      channel: "email",
      template: EmailTemplates.ABANDONED_CART || "",
      idempotency_key: `abandoned-cart:${cart.id}`,
      data: {
        customer: {
          first_name: cart.customer?.first_name || cart.shipping_address?.first_name,
          last_name: cart.customer?.last_name || cart.shipping_address?.last_name,
        },
        cart_id: cart.id,
        items: cart.items?.map((item) => ({
          product_title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          thumbnail: item.thumbnail,
        }))
      }
    }))

    const notifications = await notificationModuleService.createNotifications(
      notificationData
    )

    return new StepResponse({
      notifications
    })
  }
)
