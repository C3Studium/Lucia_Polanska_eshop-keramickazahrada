import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  cartRecoverLink,
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "./customer-email"
import { emailLineItems } from "./email-items"
import { emailLocaleOf, type EmailLocale } from "./email-locale"

/**
 * „Platba neprošla" — e-mail zákazníkovi s odkazem na opakování, když platba
 * u ComGate skončí zrušením (tlačítko „Zrušit", nedostatek peněz, zamítnutí
 * bankou, zavřená záložka → vypršení). Doplněno 14. 10. 2026: do té doby
 * zákazník z pokladny nedostal nic a u doplatku jen tehdy, když odkaz poslala
 * majitelka a zákazník se z brány nevrátil.
 *
 * ## Proč s odstupem
 *
 * Kdo platbu zruší a hned ji zkusí znovu, e-mail „neprošla" nepotřebuje — a
 * přišel by mu vedle potvrzení o zaplacení. Proto se posílá až po
 * `FAILED_PAYMENT_GRACE_MS`; do té doby nový pokus starou relaci (pokladna)
 * nebo žádost (doplatek) nahradí a e-mail se neodešle vůbec.
 *
 * ## Proč s horní hranicí a datem nasazení
 *
 * Úlohy se dívají i dny zpátky. Bez hranice by první běh po nasazení rozeslal
 * „neprošla" za všechny staré (hlavně testovací) pokusy — a denní strop Resendu
 * je 100 zpráv.
 */

export const FAILED_PAYMENT_GRACE_MS = 20 * 60 * 1000
export const FAILED_PAYMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Starší neúspěchy se nehlásí — viz hlavička. */
export const FAILED_PAYMENT_EMAILS_FROM = Date.parse("2026-10-14T18:30:00Z")

/** Je čas poslat „neprošla" za neúspěch od `since`? */
export const failedPaymentEmailDue = (
  since: unknown,
  now: Date = new Date()
): boolean => {
  const at = new Date(since as string).getTime()
  if (!Number.isFinite(at) || at < FAILED_PAYMENT_EMAILS_FROM) {
    return false
  }
  const age = now.getTime() - at
  return age >= FAILED_PAYMENT_GRACE_MS && age <= FAILED_PAYMENT_MAX_AGE_MS
}

/** Co ComGate vrací v `paymentErrorReason`, česky. */
const DUVODY: Record<string, string> = {
  NO_FUNDS: "na účtu nebyl dostatek prostředků",
  LIMIT_EXCEEDED: "byl překročen limit karty",
  REJECTED_BY_BANK: "platbu zamítla banka",
  INVALID_CARDNO_EXPIRY: "chybně zadané číslo karty nebo platnost",
  INVALID_CVC: "chybně zadaný CVC kód",
  CUSTOMER_TIMEOUT: "vypršel časový limit platby",
  ACS_TIMEOUT: "vypršel časový limit ověření",
}

export const duvodCesky = (kod: unknown): string | null => {
  const klic = String(kod ?? "").trim().toUpperCase()
  if (!klic || klic === "NOT_SPECIFIED") {
    return null
  }
  return DUVODY[klic] ?? null
}

/**
 * Důvody neúspěchu v jazyce e-mailu. Uložený důvod je česká věta
 * (`duvodCesky`, `provider_error_reason` — čte ji i administrace), proto se
 * překlad hledá podle ní; neznámá věta zůstane, jak je.
 */
const DUVODY_PREKLAD: Record<string, Record<Exclude<EmailLocale, "cs">, string>> = {
  [DUVODY.NO_FUNDS]: {
    sk: "na účte nebolo dosť prostriedkov",
    pl: "na koncie zabrakło środków",
    de: "auf dem Konto war nicht genug Guthaben",
    en: "there weren't enough funds in the account",
  },
  [DUVODY.LIMIT_EXCEEDED]: {
    sk: "bol prekročený limit karty",
    pl: "przekroczono limit karty",
    de: "das Kartenlimit wurde überschritten",
    en: "the card limit was exceeded",
  },
  [DUVODY.REJECTED_BY_BANK]: {
    sk: "platbu zamietla banka",
    pl: "bank odrzucił płatność",
    de: "die Bank hat die Zahlung abgelehnt",
    en: "the bank declined the payment",
  },
  [DUVODY.INVALID_CARDNO_EXPIRY]: {
    sk: "nesprávne zadané číslo karty alebo platnosť",
    pl: "błędnie podany numer karty lub data ważności",
    de: "Kartennummer oder Ablaufdatum falsch eingegeben",
    en: "the card number or expiry date was entered incorrectly",
  },
  [DUVODY.INVALID_CVC]: {
    sk: "nesprávne zadaný kód CVC",
    pl: "błędnie podany kod CVC",
    de: "CVC-Code falsch eingegeben",
    en: "the CVC code was entered incorrectly",
  },
  [DUVODY.CUSTOMER_TIMEOUT]: {
    sk: "vypršal časový limit platby",
    pl: "upłynął czas na dokonanie płatności",
    de: "das Zeitlimit für die Zahlung ist abgelaufen",
    en: "the time limit for the payment ran out",
  },
  [DUVODY.ACS_TIMEOUT]: {
    sk: "vypršal časový limit overenia",
    pl: "upłynął czas na weryfikację płatności",
    de: "das Zeitlimit für die Bestätigung ist abgelaufen",
    en: "the time limit for verification ran out",
  },
  // Obecné důvody doplatku (jobs/reconcile-balance-payments, FAILURE_REASONS).
  "Platba byla zrušena": {
    sk: "Platba bola zrušená",
    pl: "Płatność została anulowana",
    de: "Die Zahlung wurde abgebrochen",
    en: "The payment was cancelled",
  },
  "Platbu se nepodařilo dokončit": {
    sk: "Platbu sa nepodarilo dokončiť",
    pl: "Nie udało się dokończyć płatności",
    de: "Die Zahlung konnte nicht abgeschlossen werden",
    en: "The payment couldn't be completed",
  },
  "Platnost platebního odkazu vypršela": {
    sk: "Platnosť platobného odkazu vypršala",
    pl: "Link do płatności wygasł",
    de: "Der Zahlungslink ist abgelaufen",
    en: "The payment link has expired",
  },
}

/** Uložený (český) důvod neúspěchu v jazyce e-mailu. */
export const failureReasonIn = (
  reason: string | null | undefined,
  locale: EmailLocale
): string | undefined => {
  const text = (reason ?? "").trim()
  if (!text) return undefined
  if (locale === "cs") return text
  return DUVODY_PREKLAD[text]?.[locale] ?? text
}

/** Kolekce, u které už je zaplaceno — „neprošla" by lhala. */
const SETTLED_COLLECTION = ["authorized", "partially_authorized", "completed"]

const NAME_FIELDS = (prefix: string) => [
  `${prefix}.customer.first_name`,
  `${prefix}.customer.last_name`,
  `${prefix}.shipping_address.first_name`,
  `${prefix}.shipping_address.last_name`,
  `${prefix}.billing_address.first_name`,
  `${prefix}.billing_address.last_name`,
]

/**
 * Za co platba byla — položky košíku nebo objednávky do e-mailu.
 *
 * Samostatným dotazem, ne rozbalením přes platební kolekci: `items.*` o dva
 * skoky dál (`collection.cart.items.*`) je přesně ten tvar, u kterého
 * `query.graph` umí spadnout — a kvůli výpisu položek nesmí zmizet celý
 * e-mail „platba neprošla". Chyba tady znamená jen e-mail bez výpisu, jako
 * dřív.
 */
const polozkyProEmail = async (
  container: MedusaContainer,
  entity: "cart" | "order",
  id: string,
  locale: EmailLocale
) => {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity,
      // `items.product.metadata` = přeložený název výrobku (lib/email-locale).
      fields: ["id", "currency_code", "items.*", "items.product.metadata"],
      filters: { id },
    })
    return emailLineItems(data[0] as any, locale)
  } catch {
    return []
  }
}

/**
 * „Neprošla" za zrušenou relaci ComGate z pokladny nebo z odkazu k platbě
 * objednávky. Vrací, zda se e-mail zařadil (opakované volání se stejnou relací
 * notifikační modul přeskočí podle klíče `payfail:{session}`).
 *
 *  - **Košík** (objednávka zatím nevznikla, zakázková záloha taky) → odkaz
 *    obnoví košík v jakémkoli prohlížeči a vede rovnou na krok platby.
 *  - **Objednávka** (odkaz k platbě od majitelky) → odkaz na objednávku, odkud
 *    se platba spustí s čerstvou relací.
 *  - **Doplatek zakázky** se tu přeskakuje — má vlastní žádost a vlastní úlohu
 *    (`reconcile-balance-payments`).
 */
export const emailFailedCheckoutPayment = async (
  container: MedusaContainer,
  session: any,
  reason: string | null
): Promise<boolean> => {
  if (session?.data?.production_payment_request_id || !session?.payment_collection_id) {
    return false
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: collections } = await query.graph({
    entity: "payment_collection",
    fields: [
      "id",
      "status",
      "currency_code",
      "cart.id",
      "cart.email",
      "cart.completed_at",
      // Jazyk košíku/objednávky (lib/email-locale): storefront ho zapisuje do
      // metadat, starší mají jen zemi adresy.
      "cart.metadata",
      "cart.shipping_address.country_code",
      "cart.billing_address.country_code",
      ...NAME_FIELDS("cart"),
      "order.id",
      "order.display_id",
      "order.email",
      "order.status",
      "order.metadata",
      "order.shipping_address.country_code",
      "order.billing_address.country_code",
      ...NAME_FIELDS("order"),
    ],
    filters: { id: session.payment_collection_id },
  })
  const collection = collections[0] as any
  if (!collection || SETTLED_COLLECTION.includes(String(collection.status))) {
    return false
  }

  const order = collection.order
  const cart = collection.cart
  const locale = emailLocaleOf(order?.id ? order : cart)
  const paymentAmount = formatMoney(session.amount, collection.currency_code, locale)
  const failureReason = failureReasonIn(reason, locale)

  if (order?.id) {
    if (order.status === "canceled") {
      return false
    }
    return sendCustomerEmail(container, {
      template: "payment-failed",
      to: order.email,
      key: `payfail:${session.id}`,
      orderId: order.id,
      locale,
      data: {
        customerName: customerName(order),
        orderNumber: orderNumber(order),
        paymentAmount,
        paidFor: await polozkyProEmail(container, "order", order.id, locale),
        failureReason,
        retryLink: orderLink(order),
      },
    })
  }

  if (cart?.id && !cart.completed_at) {
    const recover = cartRecoverLink(cart.id)
    return sendCustomerEmail(container, {
      template: "payment-failed",
      to: cart.email,
      key: `payfail:${session.id}`,
      locale,
      data: {
        checkout: true,
        customerName: customerName(cart),
        paymentAmount,
        /* Obsah košíku, který odkaz obnoví — ať zákazník vidí, o co jde. */
        paidFor: await polozkyProEmail(container, "cart", cart.id, locale),
        failureReason,
        retryLink: recover ? `${recover}?step=payment` : "",
      },
    })
  }

  return false
}
