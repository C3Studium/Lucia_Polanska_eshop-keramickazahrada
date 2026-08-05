import { createStep } from "@medusajs/framework/workflows-sdk"
import { InferTypeOf, ProductVariantDTO } from "@medusajs/framework/types"
import RestockSubscription from "../../../modules/restock/models/restock-subscription"
import { productLink } from "../../../lib/customer-email"

type SendRestockNotificationStepInput = (InferTypeOf<typeof RestockSubscription> & {
  product_variant?: ProductVariantDTO & {
    product?: {
      title?: string | null
      handle?: string | null
      thumbnail?: string | null
      description?: string | null
    } | null
  }
})[]

export const sendRestockNotificationStep = createStep(
  "send-restock-notification",
  async (input: SendRestockNotificationStepInput, { container }) => {
    const notificationModuleService = container.resolve("notification")

    // One notice per subscription, ever. The job runs daily, so without a key a
    // failed send would turn into a fresh e-mail every night instead of a retry
    // of the same one.
    //
    // The data is flattened here rather than passing the DTO through: the
    // template used to dig for `variant.product_variant.images`, none of which
    // exists on a variant, so every restock mail went out with no name, no
    // picture and a /products/{variant_id} link the storefront cannot route.
    const notificationData = input.map((subscription) => {
      const variant = subscription.product_variant
      const product = variant?.product

      return {
        to: subscription.email,
        channel: "email",
        template: "variant-restock",
        idempotency_key: `restock:${subscription.id}`,
        data: {
          product_title: product?.title ?? variant?.title ?? "",
          variant_title:
            variant?.title && variant.title !== product?.title
              ? variant.title
              : "",
          description: product?.description ?? "",
          thumbnail: product?.thumbnail ?? "",
          product_url: productLink(product?.handle),
        },
      }
    })

    await notificationModuleService.createNotifications(notificationData)
  }
)
