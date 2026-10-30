import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { sendCustomerEmail } from "./customer-email"
import { giftVoucherLink } from "./gift-voucher-link"
import { formatVoucherCode } from "../modules/gift-voucher/code"
import { formatVoucherCzk, formatVoucherDate } from "./gift-voucher-view"
import { giftVoucherPdfInputFor, storeGiftVoucherPdf } from "./gift-voucher-pdf"
import { checkAttachmentUrls, type EmailAttachmentRef } from "./legal/order-legal"

/**
 * E-maily poukazů:
 * - `gift-voucher-payment` — kupujícímu: platební odkaz ComGate,
 * - `gift-voucher` — samotný elektronický poukaz s kódem (obdarovanému,
 *   nebo kupujícímu, když e-mail obdarovaného není).
 */

/** Komu poslat elektronický poukaz: obdarovanému, jinak kupujícímu. */
export const voucherRecipientEmail = (voucher: any): string | null =>
  (voucher.recipient_email || voucher.buyer_email || "").trim() || null

/**
 * Poukaz jako PDF do přílohy — elektronický poukaz se „vystaví online“ právě
 * tímhle. Selže-li vystavení nebo soubor nejde stáhnout, e-mail přesto odejde:
 * kód v těle zprávy a odkaz na stránku poukazu stačí k uplatnění, kdežto
 * neodeslaný e-mail by zákazníka nechal bez čehokoli.
 */
export const giftVoucherAttachment = async (
  container: MedusaContainer,
  voucher: any
): Promise<EmailAttachmentRef | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const pdf = await storeGiftVoucherPdf(container, await giftVoucherPdfInputFor(container, voucher))
    if (!pdf) return null
    const { reachable, failed } = await checkAttachmentUrls([pdf])
    for (const miss of failed) {
      logger.warn(
        `[poukazy] PDF poukazu ${voucher.code} (${miss.url}) nejde stáhnout (${miss.reason}) — e-mail půjde bez přílohy.`
      )
    }
    return reachable[0] ?? null
  } catch (error) {
    logger.warn(
      `[poukazy] PDF poukazu ${voucher.code} se nepodařilo vystavit: ${(error as Error)?.message ?? error}`
    )
    return null
  }
}

export const sendGiftVoucherEmail = async (
  container: MedusaContainer,
  voucher: any,
  options: { to?: string | null; reason: "paid" | "manual" } = { reason: "manual" }
): Promise<{ sent: boolean; to: string | null }> => {
  const to = (options.to || voucherRecipientEmail(voucher) || "").trim() || null
  if (!to) return { sent: false, to: null }

  const toRecipient = Boolean(voucher.recipient_email) && to === voucher.recipient_email
  // Ruční „Poslat znovu" musí odejít pokaždé; automatické po zaplacení jen jednou.
  const key =
    options.reason === "paid"
      ? `gift-voucher:paid:${voucher.id}`
      : `gift-voucher:manual:${voucher.id}:${to}:${Date.now()}`

  const attachment = await giftVoucherAttachment(container, voucher)

  const sent = await sendCustomerEmail(container, {
    template: "gift-voucher",
    to,
    key,
    ...(attachment ? { attachments: [attachment] } : {}),
    data: {
      /* Šablona o příloze ví — bez ní odkazuje na stránku poukazu. */
      pdfUrl: attachment?.url ?? null,
      // „7HQ4 M2XP" — čte se líp; do pole v košíku jde zadat i s mezerou.
      code: formatVoucherCode(voucher.code),
      value: formatVoucherCzk(voucher.initial_value),
      balance: formatVoucherCzk(voucher.balance),
      partlyUsed: Number(voucher.balance) < Number(voucher.initial_value),
      validUntil: formatVoucherDate(voucher.valid_until),
      recipientName: voucher.recipient_name || null,
      buyerName: voucher.buyer_name || null,
      dedication: voucher.dedication || null,
      toRecipient,
      voucherUrl: giftVoucherLink(voucher.id),
    },
  })

  if (sent) {
    const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
    await service.updateGiftVouchers({ id: voucher.id, sent_at: new Date(), sent_to: to } as never)
  }
  return { sent, to }
}

export const sendGiftVoucherPaymentEmail = async (
  container: MedusaContainer,
  voucher: any,
  paymentUrl: string
): Promise<boolean> => {
  const to = (voucher.buyer_email || "").trim()
  if (!to) return false
  return sendCustomerEmail(container, {
    template: "gift-voucher-payment",
    to,
    // Nový odkaz = nový e-mail; tentýž odkaz podruhé neodejde.
    key: `gift-voucher:pay:${voucher.id}:${paymentUrl.slice(-24)}`,
    data: {
      buyerName: voucher.buyer_name || null,
      value: formatVoucherCzk(voucher.initial_value),
      recipientName: voucher.recipient_name || null,
      kind: voucher.kind,
      sendTo: voucher.kind === "electronic" ? voucherRecipientEmail(voucher) : null,
      validUntil: formatVoucherDate(voucher.valid_until),
      paymentUrl,
      voucherUrl: giftVoucherLink(voucher.id),
    },
  })
}
