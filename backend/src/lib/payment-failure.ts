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
      ...NAME_FIELDS("cart"),
      "order.id",
      "order.display_id",
      "order.email",
      "order.status",
      ...NAME_FIELDS("order"),
    ],
    filters: { id: session.payment_collection_id },
  })
  const collection = collections[0] as any
  if (!collection || SETTLED_COLLECTION.includes(String(collection.status))) {
    return false
  }

  const paymentAmount = formatMoney(session.amount, collection.currency_code)
  const failureReason = reason || undefined
  const order = collection.order
  const cart = collection.cart

  if (order?.id) {
    if (order.status === "canceled") {
      return false
    }
    return sendCustomerEmail(container, {
      template: "payment-failed",
      to: order.email,
      key: `payfail:${session.id}`,
      orderId: order.id,
      data: {
        customerName: customerName(order),
        orderNumber: orderNumber(order),
        paymentAmount,
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
      data: {
        checkout: true,
        customerName: customerName(cart),
        paymentAmount,
        failureReason,
        retryLink: recover ? `${recover}?step=payment` : "",
      },
    })
  }

  return false
}
