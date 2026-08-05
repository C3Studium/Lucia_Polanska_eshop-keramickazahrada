import { 
  AbstractNotificationProviderService, 
  MedusaError
} from "@medusajs/framework/utils"
import { 
  ProviderSendNotificationDTO, 
  ProviderSendNotificationResultsDTO,
  Logger
} from "@medusajs/framework/types";
import { 
  CreateEmailOptions, 
  Resend
} from "resend";
import { orderPlacedEmail } from "./emails/order-placed";
import { userInvitedEmail } from "./emails/user-invited"
import { passwordResetEmail } from "./emails/password-reset";
import { emailVerificationEmail } from "./emails/email-verification";
import { variantRestockEmail } from "./emails/restock";
import { abandonedCartEmail } from "./emails/abandoned-cart";
import { merchantNotificationEmail } from "./emails/merchant-notification";
import { merchantDailySummaryEmail } from "./emails/merchant-daily-summary";
import { merchantWeeklySummaryEmail } from "./emails/merchant-weekly-summary";
import { PaymentReceivedEmail } from "./emails/payment-received";
import { PaymentFailedEmail } from "./emails/payment-failed";
import { PaymentPendingEmail } from "./emails/payment-pending";
import { PaymentRefundedEmail } from "./emails/payment-refunded";
import { OrderShipmentEmail } from "./emails/order-shipment";
import { OrderCancelledEmail } from "./emails/order-cancelled";
import { OrderProcessingEmail } from "./emails/order-processing";
import { OrderRefundedEmail } from "./emails/order-refunded";
import { OrderReviewEmail } from "./emails/order-review";
import { OrderReadyPickupEmail } from "./emails/order-ready-pickup";
import { OrderDeliveredEmail } from "./emails/order-delivered";
import { OrderDelayedEmail } from "./emails/order-delayed";
import { WelcomeEmail } from "./emails/welcome";
import { AccountDeletedEmail } from "./emails/account-deleted";
import { ReturnApprovedEmail } from "./emails/return-approved";
import { NewsletterSignupEmail } from "./emails/newsletter-signup";
import { NewsletterUnsubscribeEmail } from "./emails/newsletter-unsubscribe";
import { PromotionalEmail } from "./emails/promotional";
import { bundlePublishedEmail } from "./emails/bundle-published";
import { RefundRequestEmail } from "./emails/refund-request";
import { ReturnRejectedEmail } from "./emails/return-rejected";
import { PriceDropEmail } from "./emails/price-drop";

enum Templates {
  ORDER_PLACED = "order-placed",
  USER_INVITED = "user-invited",
  PASSWORD_RESET = "password-reset",
  EMAIL_VERIFICATION = "email-verification",
  VARIANT_RESTOCK = "variant-restock",
  ABANDONED_CART = "abandoned-cart",
  // The merchant's own notifications (WorkflowPlan.md §15) — one template for
  // every bell item that also goes to an inbox; the subject travels in
  // `data.subject` so each e-mail is distinguishable.
  MERCHANT_NOTIFICATION = "merchant-notification",
  MERCHANT_DAILY_SUMMARY = "merchant-daily-summary",
  MERCHANT_WEEKLY_SUMMARY = "merchant-weekly-summary",
  // The lifecycle templates (§16). All 12 existed as files and none were ever
  // sent, because the provider only maps what it lists here.
  PAYMENT_RECEIVED = "payment-received",
  PAYMENT_FAILED = "payment-failed",
  PAYMENT_PENDING = "payment-pending",
  PAYMENT_REFUNDED = "payment-refunded",
  ORDER_SHIPMENT = "order-shipment",
  ORDER_CANCELLED = "order-cancelled",
  ORDER_PROCESSING = "order-processing",
  ORDER_REFUNDED = "order-refunded",
  ORDER_REVIEW = "order-review",
  ORDER_READY_PICKUP = "order-ready-pickup",
  ORDER_DELIVERED = "order-delivered",
  ORDER_DELAYED = "order-delayed",
  WELCOME = "welcome",
  ACCOUNT_DELETED = "account-deleted",
  RETURN_APPROVED = "return-approved",
  NEWSLETTER_SIGNUP = "newsletter-signup",
  NEWSLETTER_UNSUBSCRIBE = "newsletter-unsubscribe",
  PROMOTIONAL = "promotional",
  BUNDLE_PUBLISHED = "bundle-published",
  REFUND_REQUEST = "refund-request",
  RETURN_REJECTED = "return-rejected",
  PRICE_DROP = "price-drop",
  // TODO(emails): the remaining templates in ./emails/ are designed but have
  // no trigger to hang off yet. Register them here (both enums + the map +
  // a subject) once the underlying feature exists:
  //
  // - delivery-failed — needs carrier tracking-status polling. The Zásilkovna
  //   and Balíkovna fulfillment providers create shipments but expose no
  //   status lookup; each carrier's tracking API would be its own client.
  // - password-changed / email-change / sign-in-notification — Medusa's auth
  //   module emits no events for these moments; wiring them would mean
  //   intercepting core auth routes.
  // - account-change — customer.updated exists but fires on every edit with
  //   only an id, so it cannot tell a meaningful change from noise.
  // - address-added — deliberately NOT wired: checkout creates addresses, so
  //   every first purchase would trigger a confusing "address added" mail.
  // - payment-cancelled — deliberately NOT wired: a cancelled checkout
  //   payment never completes the cart (no order exists; abandoned-cart
  //   covers it) and failed balance payments already send payment-failed.
  // - order-refunded — deliberately NOT wired: payment-refunded covers the
  //   whole refund story (a ComGate refund is a single step).
}

// WIP: Create a type for the templates - for all needed emails that will be send to customers
// workflow has to be defined and the email templates have to be created, and subscribers have to be created for the emails, so that they can be used in the service
// and added to the templates object below

const templates: {[key in Templates]?: (props: unknown) => React.ReactNode} = {
  [Templates.ORDER_PLACED]: orderPlacedEmail,
  [Templates.USER_INVITED]: userInvitedEmail,
  [Templates.PASSWORD_RESET]: passwordResetEmail,
  [Templates.EMAIL_VERIFICATION]: emailVerificationEmail,
  [Templates.VARIANT_RESTOCK]: variantRestockEmail,
  [Templates.ABANDONED_CART]: abandonedCartEmail,
  [Templates.MERCHANT_NOTIFICATION]: merchantNotificationEmail,
  [Templates.MERCHANT_DAILY_SUMMARY]: merchantDailySummaryEmail,
  [Templates.MERCHANT_WEEKLY_SUMMARY]: merchantWeeklySummaryEmail,
  [Templates.PAYMENT_RECEIVED]: PaymentReceivedEmail,
  [Templates.PAYMENT_FAILED]: PaymentFailedEmail,
  [Templates.PAYMENT_PENDING]: PaymentPendingEmail,
  [Templates.PAYMENT_REFUNDED]: PaymentRefundedEmail,
  [Templates.ORDER_SHIPMENT]: OrderShipmentEmail,
  [Templates.ORDER_CANCELLED]: OrderCancelledEmail,
  [Templates.ORDER_PROCESSING]: OrderProcessingEmail,
  [Templates.ORDER_REFUNDED]: OrderRefundedEmail,
  [Templates.ORDER_REVIEW]: OrderReviewEmail,
  [Templates.ORDER_READY_PICKUP]: OrderReadyPickupEmail,
  [Templates.ORDER_DELIVERED]: OrderDeliveredEmail,
  [Templates.ORDER_DELAYED]: OrderDelayedEmail,
  [Templates.WELCOME]: WelcomeEmail,
  [Templates.ACCOUNT_DELETED]: AccountDeletedEmail,
  [Templates.RETURN_APPROVED]: ReturnApprovedEmail,
  [Templates.NEWSLETTER_SIGNUP]: NewsletterSignupEmail,
  [Templates.NEWSLETTER_UNSUBSCRIBE]: NewsletterUnsubscribeEmail,
  [Templates.PROMOTIONAL]: PromotionalEmail,
  [Templates.BUNDLE_PUBLISHED]: bundlePublishedEmail,
  [Templates.REFUND_REQUEST]: RefundRequestEmail,
  [Templates.RETURN_REJECTED]: ReturnRejectedEmail,
  [Templates.PRICE_DROP]: PriceDropEmail,
}

export enum EmailTemplates {
  ORDER_PLACED = "order-placed",
  USER_INVITED = "user-invited",
  PASSWORD_RESET = "password-reset",
  EMAIL_VERIFICATION = "email-verification",
  VARIANT_RESTOCK = "variant-restock",
  ABANDONED_CART = "abandoned-cart",
  MERCHANT_NOTIFICATION = "merchant-notification",
  MERCHANT_DAILY_SUMMARY = "merchant-daily-summary",
  MERCHANT_WEEKLY_SUMMARY = "merchant-weekly-summary",
  // The lifecycle templates (§16). All 12 existed as files and none were ever
  // sent, because the provider only maps what it lists here.
  PAYMENT_RECEIVED = "payment-received",
  PAYMENT_FAILED = "payment-failed",
  PAYMENT_PENDING = "payment-pending",
  PAYMENT_REFUNDED = "payment-refunded",
  ORDER_SHIPMENT = "order-shipment",
  ORDER_CANCELLED = "order-cancelled",
  ORDER_PROCESSING = "order-processing",
  ORDER_REFUNDED = "order-refunded",
  ORDER_REVIEW = "order-review",
  ORDER_READY_PICKUP = "order-ready-pickup",
  ORDER_DELIVERED = "order-delivered",
  ORDER_DELAYED = "order-delayed",
  WELCOME = "welcome",
  ACCOUNT_DELETED = "account-deleted",
  RETURN_APPROVED = "return-approved",
  NEWSLETTER_SIGNUP = "newsletter-signup",
  NEWSLETTER_UNSUBSCRIBE = "newsletter-unsubscribe",
  PROMOTIONAL = "promotional",
  BUNDLE_PUBLISHED = "bundle-published",
  REFUND_REQUEST = "refund-request",
  RETURN_REJECTED = "return-rejected",
  PRICE_DROP = "price-drop",
}

/**
 * Turns whatever Resend (or the network) handed back into one readable line.
 *
 * The SDK reports failures two different ways — a returned `error` object for
 * API-level rejections and a thrown exception for transport problems — and both
 * used to end up in the log as `[object Object]` or nothing at all. The name is
 * kept because it is the part that says *whose* fault it is:
 * `validation_error` / `missing_api_key` are ours, `rate_limit_exceeded` and
 * `application_error` are Resend's.
 */
export const describeResendError = (error: unknown): string => {
  if (!error) {
    return "Resend nevrátil ID e-mailu ani chybu."
  }
  if (typeof error === "string") {
    return error
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  if (typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown; statusCode?: unknown }
    const parts = [
      typeof candidate.name === "string" ? candidate.name : null,
      typeof candidate.message === "string" ? candidate.message : null,
      typeof candidate.statusCode === "number" ? `HTTP ${candidate.statusCode}` : null,
    ].filter(Boolean)

    if (parts.length) {
      return parts.join(": ")
    }
  }
  return JSON.stringify(error)
}

type ResendOptions = {
  api_key: string
  from: string
  html_templates?: Record<string, {
    subject?: string
    content: string
  }>
}

type InjectedDependencies = {
  logger: Logger
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private resendClient: Resend
  private options: ResendOptions
  private logger: Logger

  constructor(
    { logger }: InjectedDependencies, 
    options: ResendOptions
  ) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      )
    }
  }


  getTemplate(template: Templates) {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content
    }
    const allowedTemplates = Object.keys(templates)

    if (!allowedTemplates.includes(template)) {
      return null
    }

    return templates[template]
  }

  getTemplateSubject(template: Templates) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject
    }
    switch(template) {
      case Templates.ORDER_PLACED:
        return "Objednávka přijata — děkujeme"
      case Templates.USER_INVITED:
        return "Pozvánka do administrace Keramické zahrady"
      case Templates.PASSWORD_RESET:
        return "Obnovení hesla"
      case Templates.EMAIL_VERIFICATION:
        return "Potvrďte svou e-mailovou adresu"
      case Templates.VARIANT_RESTOCK:
        return "Objekt je zpět skladem"
      case Templates.ABANDONED_CART:
        return "Váš košík na vás čeká"
      case Templates.MERCHANT_NOTIFICATION:
        return "Upozornění z e-shopu"
      case Templates.MERCHANT_DAILY_SUMMARY:
        return "Denní souhrn"
      case Templates.MERCHANT_WEEKLY_SUMMARY:
        return "Týdenní souhrn"
      // §16 subjects, verbatim.
      case Templates.PAYMENT_RECEIVED:
        return "Platba přijata — děkujeme"
      case Templates.PAYMENT_FAILED:
        return "Platba se nezdařila"
      case Templates.PAYMENT_PENDING:
        return "Odkaz k platbě objednávky"
      case Templates.PAYMENT_REFUNDED:
        return "Vracíme peníze"
      case Templates.ORDER_SHIPMENT:
        return "Objednávka odeslána"
      case Templates.ORDER_CANCELLED:
        return "Objednávka zrušena"
      case Templates.ORDER_PROCESSING:
        return "Zadání potvrzeno — začínáme"
      case Templates.ORDER_REFUNDED:
        return "Objednávka vrácena"
      case Templates.ORDER_REVIEW:
        return "Jak se vám líbí nový kousek?"
      case Templates.ORDER_READY_PICKUP:
        return "Zásilka připravena k vyzvednutí"
      case Templates.ORDER_DELIVERED:
        return "Zásilka doručena"
      case Templates.ORDER_DELAYED:
        return "Výroba se protáhne"
      case Templates.WELCOME:
        return "Vítejte v Keramické zahradě"
      case Templates.ACCOUNT_DELETED:
        return "Váš účet byl smazán"
      case Templates.RETURN_APPROVED:
        return "Vrácení schváleno"
      case Templates.NEWSLETTER_SIGNUP:
        return "Vítejte v okruhu ateliéru"
      case Templates.NEWSLETTER_UNSUBSCRIBE:
        return "Odhlášení potvrzeno"
      case Templates.PROMOTIONAL:
        return "Z ateliéru — objekty za příznivější cenu"
      case Templates.BUNDLE_PUBLISHED:
        return "Nový balíček z ateliéru je k nahlédnutí"
      case Templates.REFUND_REQUEST:
        return "Žádost o vrácení jsme přijali"
      case Templates.RETURN_REJECTED:
        return "Žádost o vrácení nemůžeme přijmout"
      case Templates.PRICE_DROP:
        return "Objekt změnil cenu"
      // WIP: Add more cases for other templates as needed
      default:
        return "Zpráva z Keramické zahrady"
    }
    
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const template = this.getTemplate(notification.template as Templates)

    if (!template) {
      // Throw rather than return: a returned result is recorded as a *successful*
      // notification, so an unregistered template used to look delivered while
      // the customer got nothing. Throwing makes the notification module mark the
      // row `status = failure` (notification-module-service.js:95-99), which is
      // what the bell, /prehled/emaily and notification #15 all read.
      const message =
        `Nepodařilo se odeslat e-mail: šablona "${notification.template}" není v Resend providovi zaregistrovaná. ` +
        `Registrované šablony: ${Object.values(Templates).join(", ")}.`
      this.logger.error(
        `[resend] ${message} (příjemce: ${notification.to}, kanál: ${notification.channel})`
      )
      throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
    }

    // A per-send subject wins over the template default. Merchant notifications
    // all share one template but must not all share one subject line — an inbox
    // full of identical subjects is unreadable. Templates that do not set it
    // behave exactly as before.
    const providedSubject = (notification.data as Record<string, unknown> | undefined)?.subject

    const commonOptions = {
      from: this.options.from,
      to: [notification.to],
      subject:
        typeof providedSubject === "string" && providedSubject.trim().length
          ? providedSubject
          : this.getTemplateSubject(notification.template as Templates),
    }

    let emailOptions: CreateEmailOptions
    if (typeof template === "string") {
      emailOptions = {
        ...commonOptions,
        html: template,
      }
    } else {
      emailOptions = {
        ...commonOptions,
        react: template(notification.data),
      }
    }

    let data: { id: string } | null = null
    let error: unknown = null

    try {
      const response = await this.resendClient.emails.send(emailOptions)
      data = response.data
      error = response.error
    } catch (thrown) {
      // The SDK throws on transport-level problems (DNS, timeout, aborted
      // connection) instead of returning an `error`, and those used to escape
      // this method unlabelled.
      error = thrown
    }

    if (error || !data) {
      const detail = describeResendError(error)

      // Logged with everything needed to tell a Resend problem (bad API key,
      // unverified domain, rate limit) apart from ours (bad template data).
      this.logger.error(
        `[resend] Nepodařilo se odeslat e-mail "${notification.template}" na ${notification.to}: ${detail}`
      )

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend odmítl e-mail "${notification.template}" pro ${notification.to}: ${detail}`
      )
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
