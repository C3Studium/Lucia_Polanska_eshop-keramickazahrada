import { createStep } from "@medusajs/framework/workflows-sdk"
import { InferTypeOf, ProductVariantDTO } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import RestockSubscription from "../../../modules/restock/models/restock-subscription"
import { productLink } from "../../../lib/customer-email"
import { customerByEmail, customerLocaleOf } from "../../../lib/customer-locale"
import { localizedProductName, type EmailLocale } from "../../../lib/email-locale"
import { translateTitles } from "../../../lib/google-translate"

type SendRestockNotificationStepInput = (InferTypeOf<typeof RestockSubscription> & {
  product_variant?: ProductVariantDTO & {
    product?: {
      title?: string | null
      handle?: string | null
      thumbnail?: string | null
      description?: string | null
      metadata?: Record<string, unknown> | null
    } | null
  }
})[]

/** Výchozí české provedení — v cizojazyčném e-mailu nic neříká. */
const CESKE_VYCHOZI_PROVEDENI = /^(standardní|výchozí|default(\s+variant)?)$/i

export const sendRestockNotificationStep = createStep(
  "send-restock-notification",
  async (input: SendRestockNotificationStepInput, { container }) => {
    const notificationModuleService = container.resolve("notification")

    /*
     * Jazyk odběratele: odběr sám jazyk nenese (tabulka má jen e-mail
     * a zákazníka), takže se vezme z účtu — `customer.metadata.locale`
     * z registrace (lib/customer-locale). Host bez účtu dostane češtinu.
     */
    const localeOf = async (
      subscription: SendRestockNotificationStepInput[number]
    ): Promise<EmailLocale | null> => {
      try {
        const customer = subscription.customer_id
          ? await container.resolve(Modules.CUSTOMER).retrieveCustomer(subscription.customer_id)
          : await customerByEmail(container, subscription.email)
        return customerLocaleOf(customer)
      } catch {
        return null
      }
    }

    // One notice per subscription, ever. The job runs daily, so without a key a
    // failed send would turn into a fresh e-mail every night instead of a retry
    // of the same one.
    //
    // The data is flattened here rather than passing the DTO through: the
    // template used to dig for `variant.product_variant.images`, none of which
    // exists on a variant, so every restock mail went out with no name, no
    // picture and a /products/{variant_id} link the storefront cannot route.
    const notificationData = await Promise.all(
      input.map(async (subscription) => {
        const variant = subscription.product_variant
        const product = variant?.product
        const locale = await localeOf(subscription)
        const foreign = Boolean(locale && locale !== "cs")
        // Název produktu přeloží Google; bez klíče zůstane český.
        if (foreign && product?.title) await translateTitles([product.title], locale!)
        const variantTitle =
          variant?.title && variant.title !== product?.title ? variant.title : ""

        return {
          to: subscription.email,
          channel: "email",
          template: "variant-restock",
          idempotency_key: `restock:${subscription.id}`,
          data: {
            product_title:
              (product?.title ? localizedProductName(product.title, locale) : null) ||
              variant?.title ||
              "",
            variant_title:
              foreign && CESKE_VYCHOZI_PROVEDENI.test(variantTitle) ? "" : variantTitle,
            description: product?.description ?? "",
            thumbnail: product?.thumbnail ?? "",
            product_url: productLink(product?.handle),
            ...(foreign ? { locale } : {}),
          },
        }
      })
    )

    await notificationModuleService.createNotifications(notificationData)
  }
)
