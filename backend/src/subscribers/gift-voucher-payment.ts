import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { sendGiftVoucherEmail, voucherRecipientEmail } from "../lib/gift-voucher-emails"
import { formatVoucherCzk } from "../lib/gift-voucher-view"
import { notifyMerchant } from "../lib/notify"
import { syncPurchasedVouchers } from "../lib/gift-voucher-orders"
import { syncVoucherPromotionSafe } from "../lib/gift-voucher-promotion"

/**
 * Platba za poukaz dorazila (ComGate → `processPaymentWorkflow` →
 * `payment.captured`, stejná cesta jako kurzy — viz `lib/gift-voucher-payment.ts`).
 *
 * Poukaz pozná podle relace uložené na poukazu; cizí platby (objednávky,
 * kurzy, doplatky) skončí jedním dotazem. Idempotentní: `paid_at` se zapíše
 * jednou, e-mail poukazu má klíč `gift-voucher:paid:{id}` a zpráva majitelce
 * vlastní klíč — opakované doručení události nic nezdvojí.
 */
export default async function giftVoucherPaymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: payments } = await query.graph({
    entity: "payment",
    fields: ["id", "captured_at", "payment_session_id", "payment_collection_id"],
    filters: { id: data.id },
  })
  const payment = payments[0] as any
  const sessionId = payment?.payment_session_id
  if (!sessionId) return

  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ payment_session_id: sessionId } as never)) as any[]
  if (!voucher) {
    // Platba objednávky — mohly v ní být poukazy koupené jako výrobek, které
    // čekaly na zaplacení (převod, dobírka, nebo dřívější `order.placed`).
    await syncVouchersOfPaidOrder(container, payment.payment_collection_id)
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paidAt = payment.captured_at ? new Date(payment.captured_at) : new Date()

  if (voucher.payment_status !== "paid") {
    await service.updateGiftVouchers({ id: voucher.id, payment_status: "paid", paid_at: paidAt } as never)
    voucher.payment_status = "paid"
    voucher.paid_at = paidAt
  }
  // Zaplacený poukaz = platný slevový kód (zrušenému se akce vypne).
  await syncVoucherPromotionSafe(container, voucher.id)

  if (voucher.status === "cancelled") {
    logger.warn(`[poukazy] Platba dorazila ke zrušenému poukazu ${voucher.code} — vrátit ručně.`)
    await notifyMerchant(container, {
      key: `mn:gift-voucher-paid-cancelled:${voucher.id}`,
      title: `Poukazy: platba ke zrušenému poukazu ${voucher.code}`,
      description: `Platba ${formatVoucherCzk(voucher.initial_value)} od ${voucher.buyer_name} dorazila k poukazu, který je mezitím zrušený. Peníze je potřeba vrátit v ComGate.`,
      audience: "owner",
      urgent: true,
    }).catch(() => undefined)
    return
  }

  let mailLine = ""
  if (voucher.kind === "electronic") {
    const outcome = await sendGiftVoucherEmail(container, voucher, { reason: "paid" }).catch((error) => {
      logger.error(`[poukazy] Poukaz ${voucher.code} se nepodařilo poslat: ${error?.message ?? error}`)
      return { sent: false, to: voucherRecipientEmail(voucher) }
    })
    mailLine = outcome.sent
      ? `Elektronický poukaz odešel na ${outcome.to}.`
      : "Elektronický poukaz se NEPODAŘILO poslat — pošlete ho ze stránky Poukazy."
  } else {
    mailLine = "Je to vytištěný poukaz — vytiskněte ho na stránce Poukazy a pošlete nebo předejte."
  }

  await notifyMerchant(container, {
    key: `mn:gift-voucher-paid:${voucher.id}`,
    title: `Poukaz zaplacen — ${voucher.code} (${formatVoucherCzk(voucher.initial_value)})`,
    description: [
      `Kupující: ${voucher.buyer_name}${voucher.buyer_email ? ` <${voucher.buyer_email}>` : ""}`,
      voucher.recipient_name ? `Pro: ${voucher.recipient_name}` : null,
      mailLine,
    ]
      .filter(Boolean)
      .join("\n"),
    audience: "owner",
    email: true,
  }).catch(() => undefined)
}

const syncVouchersOfPaidOrder = async (container: any, collectionId: string | null | undefined) => {
  if (!collectionId) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { data } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "order.id"],
      filters: { id: collectionId },
    })
    const orderId = (data?.[0] as any)?.order?.id
    if (orderId) await syncPurchasedVouchers(container, orderId)
  } catch (error) {
    logger.warn(`[poukazy] Platba ${collectionId}: poukazy objednávky se nepodařilo srovnat: ${(error as Error)?.message ?? error}`)
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
