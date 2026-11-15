/**
 * Texty šablon, které jdou upravit v administraci → Emaily (15. 11. 2026).
 *
 * Šablona → její objekt `COPY` (texty po jazycích). Upravuje se jen čeština
 * a jen textová pole; funkce (např. skloňování) zůstávají v kódu. Šablony
 * bez `COPY` (kurzy, souhrny pro majitelku) tu nejsou — u nich jde upravit
 * jen předmět.
 *
 * Seznam odpovídá souborům `emails/*.tsx` s `export const COPY`.
 */
import type { Localized } from "../../lib/email-locale"
import { COPY as COPY_ABANDONED_CART } from "./emails/abandoned-cart"
import { COPY as COPY_ACCOUNT_DELETED } from "./emails/account-deleted"
import { COPY as COPY_COMMISSION_CANCELLED } from "./emails/commission-cancelled"
import { COPY as COPY_COMMISSION_COMPLETED } from "./emails/commission-completed"
import { COPY as COPY_COMMISSION_CONFIRMED } from "./emails/commission-confirmed"
import { COPY as COPY_COMMISSION_INQUIRY_RECEIVED } from "./emails/commission-inquiry-received"
import { COPY as COPY_COMMISSION_MESSAGE } from "./emails/commission-message"
import { COPY as COPY_COMMISSION_PRICE_AGREED } from "./emails/commission-price-agreed"
import { COPY as COPY_CONTACT_RECEIVED } from "./emails/contact-received"
import { COPY as COPY_CONTRACT_RESENT } from "./emails/contract-resent"
import { COPY as COPY_EMAIL_VERIFICATION } from "./emails/email-verification"
import { COPY as COPY_GIFT_VOUCHER } from "./emails/gift-voucher"
import { COPY as COPY_GIFT_VOUCHER_PAYMENT } from "./emails/gift-voucher-payment"
import { COPY as COPY_INVOICE_ISSUED } from "./emails/invoice-issued"
import { COPY as COPY_LOYALTY_CODE } from "./emails/loyalty-code"
import { COPY as COPY_NEWSLETTER_SIGNUP } from "./emails/newsletter-signup"
import { COPY as COPY_NEWSLETTER_UNSUBSCRIBE } from "./emails/newsletter-unsubscribe"
import { COPY as COPY_NEWSLETTER_WELCOME } from "./emails/newsletter-welcome"
import { COPY as COPY_ORDER_CANCELLED } from "./emails/order-cancelled"
import { COPY as COPY_ORDER_DELAYED } from "./emails/order-delayed"
import { COPY as COPY_ORDER_DELIVERED } from "./emails/order-delivered"
import { COPY as COPY_ORDER_EDITED } from "./emails/order-edited"
import { COPY as COPY_ORDER_PLACED } from "./emails/order-placed"
import { COPY as COPY_ORDER_PREPARING } from "./emails/order-preparing"
import { COPY as COPY_ORDER_PROCESSING } from "./emails/order-processing"
import { COPY as COPY_ORDER_READY } from "./emails/order-ready"
import { COPY as COPY_ORDER_READY_PICKUP } from "./emails/order-ready-pickup"
import { COPY as COPY_ORDER_REFUNDED } from "./emails/order-refunded"
import { COPY as COPY_ORDER_REVIEW } from "./emails/order-review"
import { COPY as COPY_ORDER_SHIPMENT } from "./emails/order-shipment"
import { COPY as COPY_PASSWORD_RESET } from "./emails/password-reset"
import { COPY as COPY_PAYMENT_FAILED } from "./emails/payment-failed"
import { COPY as COPY_PAYMENT_PENDING } from "./emails/payment-pending"
import { COPY as COPY_PAYMENT_RECEIVED } from "./emails/payment-received"
import { COPY as COPY_PAYMENT_REFUNDED } from "./emails/payment-refunded"
import { COPY as COPY_PRICE_DROP } from "./emails/price-drop"
import { COPY as COPY_PRODUCTION_STARTED } from "./emails/production-started"
import { COPY as COPY_REFUND_REQUEST } from "./emails/refund-request"
import { COPY as COPY_RESTOCK } from "./emails/restock"
import { COPY as COPY_RETURN_APPROVED } from "./emails/return-approved"
import { COPY as COPY_RETURN_RECEIVED } from "./emails/return-received"
import { COPY as COPY_RETURN_REJECTED } from "./emails/return-rejected"
import { COPY as COPY_RETURN_RESOLVED } from "./emails/return-resolved"
import { COPY as COPY_SURCHARGE_CONFIRMED } from "./emails/surcharge-confirmed"
import { COPY as COPY_SURCHARGE_NOTICE } from "./emails/surcharge-notice"
import { COPY as COPY_WELCOME } from "./emails/welcome"

export const EMAIL_COPY: Record<string, Localized<Record<string, unknown>>> = {
  "abandoned-cart": COPY_ABANDONED_CART as unknown as Localized<Record<string, unknown>>,
  "account-deleted": COPY_ACCOUNT_DELETED as unknown as Localized<Record<string, unknown>>,
  "commission-cancelled": COPY_COMMISSION_CANCELLED as unknown as Localized<Record<string, unknown>>,
  "commission-completed": COPY_COMMISSION_COMPLETED as unknown as Localized<Record<string, unknown>>,
  "commission-confirmed": COPY_COMMISSION_CONFIRMED as unknown as Localized<Record<string, unknown>>,
  "commission-inquiry-received": COPY_COMMISSION_INQUIRY_RECEIVED as unknown as Localized<Record<string, unknown>>,
  "commission-message": COPY_COMMISSION_MESSAGE as unknown as Localized<Record<string, unknown>>,
  "commission-price-agreed": COPY_COMMISSION_PRICE_AGREED as unknown as Localized<Record<string, unknown>>,
  "contact-received": COPY_CONTACT_RECEIVED as unknown as Localized<Record<string, unknown>>,
  "contract-resent": COPY_CONTRACT_RESENT as unknown as Localized<Record<string, unknown>>,
  "email-verification": COPY_EMAIL_VERIFICATION as unknown as Localized<Record<string, unknown>>,
  "gift-voucher": COPY_GIFT_VOUCHER as unknown as Localized<Record<string, unknown>>,
  "gift-voucher-payment": COPY_GIFT_VOUCHER_PAYMENT as unknown as Localized<Record<string, unknown>>,
  "invoice-issued": COPY_INVOICE_ISSUED as unknown as Localized<Record<string, unknown>>,
  "loyalty-code": COPY_LOYALTY_CODE as unknown as Localized<Record<string, unknown>>,
  "newsletter-signup": COPY_NEWSLETTER_SIGNUP as unknown as Localized<Record<string, unknown>>,
  "newsletter-unsubscribe": COPY_NEWSLETTER_UNSUBSCRIBE as unknown as Localized<Record<string, unknown>>,
  "newsletter-welcome": COPY_NEWSLETTER_WELCOME as unknown as Localized<Record<string, unknown>>,
  "order-cancelled": COPY_ORDER_CANCELLED as unknown as Localized<Record<string, unknown>>,
  "order-delayed": COPY_ORDER_DELAYED as unknown as Localized<Record<string, unknown>>,
  "order-delivered": COPY_ORDER_DELIVERED as unknown as Localized<Record<string, unknown>>,
  "order-edited": COPY_ORDER_EDITED as unknown as Localized<Record<string, unknown>>,
  "order-placed": COPY_ORDER_PLACED as unknown as Localized<Record<string, unknown>>,
  "order-preparing": COPY_ORDER_PREPARING as unknown as Localized<Record<string, unknown>>,
  "order-processing": COPY_ORDER_PROCESSING as unknown as Localized<Record<string, unknown>>,
  "order-ready": COPY_ORDER_READY as unknown as Localized<Record<string, unknown>>,
  "order-ready-pickup": COPY_ORDER_READY_PICKUP as unknown as Localized<Record<string, unknown>>,
  "order-refunded": COPY_ORDER_REFUNDED as unknown as Localized<Record<string, unknown>>,
  "order-review": COPY_ORDER_REVIEW as unknown as Localized<Record<string, unknown>>,
  "order-shipment": COPY_ORDER_SHIPMENT as unknown as Localized<Record<string, unknown>>,
  "password-reset": COPY_PASSWORD_RESET as unknown as Localized<Record<string, unknown>>,
  "payment-failed": COPY_PAYMENT_FAILED as unknown as Localized<Record<string, unknown>>,
  "payment-pending": COPY_PAYMENT_PENDING as unknown as Localized<Record<string, unknown>>,
  "payment-received": COPY_PAYMENT_RECEIVED as unknown as Localized<Record<string, unknown>>,
  "payment-refunded": COPY_PAYMENT_REFUNDED as unknown as Localized<Record<string, unknown>>,
  "price-drop": COPY_PRICE_DROP as unknown as Localized<Record<string, unknown>>,
  "production-started": COPY_PRODUCTION_STARTED as unknown as Localized<Record<string, unknown>>,
  "refund-request": COPY_REFUND_REQUEST as unknown as Localized<Record<string, unknown>>,
  "variant-restock": COPY_RESTOCK as unknown as Localized<Record<string, unknown>>,
  "return-approved": COPY_RETURN_APPROVED as unknown as Localized<Record<string, unknown>>,
  "return-received": COPY_RETURN_RECEIVED as unknown as Localized<Record<string, unknown>>,
  "return-rejected": COPY_RETURN_REJECTED as unknown as Localized<Record<string, unknown>>,
  "return-resolved": COPY_RETURN_RESOLVED as unknown as Localized<Record<string, unknown>>,
  "surcharge-confirmed": COPY_SURCHARGE_CONFIRMED as unknown as Localized<Record<string, unknown>>,
  "surcharge-notice": COPY_SURCHARGE_NOTICE as unknown as Localized<Record<string, unknown>>,
  "welcome": COPY_WELCOME as unknown as Localized<Record<string, unknown>>,
}
