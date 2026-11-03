import type { MedusaContainer } from "@medusajs/framework/types"
import {
  customerName,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
import { isDobirkaFeeLine } from "../dobirka-fee"
import { isPackagingLine } from "../packaging"
import { lineQuantityOf, toNumber } from "../order-quantity"
import { emailLocaleOf, localizedLineTitle, type EmailLocale } from "../email-locale"
import { loadEditOrder } from "./core"

/**
 * E-mail „Objednávka upravena" (docs/uprava-objednavky-plan.md §3d.11) po
 * uložené zákaznické úpravě — z jádra (hned) i ze subscriberu platby
 * (po zaplacení rozdílu). Obsah se skládá z ČERSTVÉ objednávky, tedy už
 * po úpravě. Klíč na změnu: opakované doručení události nepošle dvakrát.
 * Best-effort — chyba e-mailu úpravu nikdy nevrací.
 *
 * Jazyk objednávky (lib/email-locale): `moneySentence` je česká věta ze
 * souhrnu na webu; cizojazyčný e-mail si ji složí znovu přes `sentence`.
 */
export const sendOrderEditedEmail = async (
  container: MedusaContainer,
  orderId: string,
  input: {
    changeId: string
    difference: number
    moneySentence: string
    /** Táž věta v jazyce e-mailu; bez ní jde česká `moneySentence`. */
    sentence?: (locale: EmailLocale, currencyCode: string) => string
  }
): Promise<boolean> => {
  const order = await loadEditOrder(container, orderId)
  if (!order) return false
  const currency = order.currency_code
  const locale = emailLocaleOf(order as never)
  const items = ((order.items ?? []) as any[])
    // Doběrečné ani balné nejsou zboží — v obsahu objednávky by mátly.
    .filter((item) => !isDobirkaFeeLine(item) && !isPackagingLine(item) && lineQuantityOf(item) > 0)
    .map((item) => {
      const variant =
        item.variant_title && !/^(standardní|default)/i.test(String(item.variant_title))
          ? ` · ${item.variant_title}`
          : ""
      return `${lineQuantityOf(item)}× ${localizedLineTitle(item, locale) || item.title}${variant}`
    })
    .join("\n")

  return sendCustomerEmail(container, {
    template: "order-edited",
    to: order.email,
    key: `order-edited:${input.changeId}`,
    orderId: order.id,
    locale,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      items,
      // Bylo = nový součet minus rozdíl úpravy (subscriber platby zná jen rozdíl).
      totalBefore: formatMoney(toNumber(order.total) - input.difference, currency, locale),
      totalAfter: formatMoney(toNumber(order.total), currency, locale),
      moneySentence:
        locale !== "cs" && input.sentence
          ? input.sentence(locale, String(currency ?? "czk"))
          : input.moneySentence,
    },
  })
}
