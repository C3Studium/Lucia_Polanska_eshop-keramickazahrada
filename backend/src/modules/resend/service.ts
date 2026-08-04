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
  //WIP add in more templates and triggers
  // Add in Order Status
  // Add in payment status
  // Add in other relevant templates
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
}

export enum EmailTemplates {
  ORDER_PLACED = "order-placed",
  USER_INVITED = "user-invited",
  PASSWORD_RESET = "password-reset",
  EMAIL_VERIFICATION = "email-verification",
  VARIANT_RESTOCK = "variant-restock",
  ABANDONED_CART = "abandoned-cart",
  MERCHANT_NOTIFICATION = "merchant-notification",
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
        return "Order Confirmation"
      case Templates.USER_INVITED:
        return "You've been invited to join"
      case Templates.PASSWORD_RESET:
        return "Reset Your Password"
      case Templates.EMAIL_VERIFICATION:
        return "Verify Your Email Address"
      case Templates.VARIANT_RESTOCK:
        return "Product Back in Stock"
      case Templates.ABANDONED_CART:
        return "Don't forget your items"
      case Templates.MERCHANT_NOTIFICATION:
        return "Upozornění z e-shopu"
      // WIP: Add more cases for other templates as needed
      default:
        return "New Email"
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
