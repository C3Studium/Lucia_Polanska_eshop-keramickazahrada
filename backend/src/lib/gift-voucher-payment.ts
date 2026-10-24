import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { COMGATE_PROVIDER_ID, paymentUrlFromSession } from "./balance-payment"
import { giftVoucherPath } from "./gift-voucher-link"

/** Metadata platební kolekce, podle kterých se pozná platba za poukaz. */
export const GIFT_VOUCHER_COLLECTION_KEY = "gift_voucher_id"

/**
 * Platební odkaz ComGate pro poukaz — stejně jako u kurzů
 * (`lib/course-payment.ts`, tam je vysvětleno proč samostatná kolekce):
 * kolekce bez objednávky → relace ComGate → ověřené oznámení
 * `/hooks/payment/pp_comgate_comgate` (nebo dohled
 * `jobs/reconcile-gift-voucher-payments.ts`) → `processPaymentWorkflow`
 * autorizuje A zachytí → `payment.captured` →
 * `subscribers/gift-voucher-payment.ts` označí poukaz jako zaplacený.
 *
 * Existující použitelný odkaz se vrací beze změny (dvojklik = jedna platba).
 */
export const ensureGiftVoucherPaymentLink = async (
  container: MedusaContainer,
  voucher: any
): Promise<{ payment_url: string; reused: boolean }> => {
  if (voucher.payment_status === "paid") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Tento poukaz je už zaplacený.")
  }
  if (voucher.status === "cancelled") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Tento poukaz je zrušený.")
  }

  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const paymentModule = container.resolve(Modules.PAYMENT)

  if (voucher.payment_url && voucher.payment_session_id) {
    const session = await paymentModule.retrievePaymentSession(voucher.payment_session_id).catch(() => null)
    const providerStatus = String(
      (session?.data as any)?.provider_status ?? (session?.data as any)?.providerStatus ?? ""
    ).toUpperCase()
    if (session && session.status !== "canceled" && providerStatus !== "CANCELLED") {
      return { payment_url: voucher.payment_url, reused: true }
    }
  }

  const amount = Math.round(Number(voucher.initial_value))
  if (!(amount > 0)) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Poukaz nemá kladnou hodnotu — platbu nelze vytvořit.")
  }

  const collection = voucher.payment_collection_id
    ? await paymentModule.retrievePaymentCollection(voucher.payment_collection_id)
    : await paymentModule.createPaymentCollections({
        currency_code: voucher.currency_code || "czk",
        amount,
        metadata: { [GIFT_VOUCHER_COLLECTION_KEY]: voucher.id },
      })

  if (!voucher.payment_collection_id) {
    await service.updateGiftVouchers({ id: voucher.id, payment_collection_id: collection.id } as never)
  }

  const { result: session } = await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: collection.id,
      provider_id: COMGATE_PROVIDER_ID,
      data: {
        method: "ALL",
        email: voucher.buyer_email || undefined,
        phone: voucher.buyer_phone || undefined,
        full_name: voucher.buyer_name,
        country_code: "CZ",
        label: "Darkovy poukaz".slice(0, 16),
        name: `Dárkový poukaz ${voucher.code}`,
        lang: "cs",
        category: "OTHER",
        delivery: voucher.kind === "electronic" ? "ELECTRONIC_DELIVERY" : "HOME_DELIVERY",
        url_paid: giftVoucherPath(voucher.id, "paid"),
        url_cancelled: giftVoucherPath(voucher.id, "cancelled"),
        url_pending: giftVoucherPath(voucher.id, "pending"),
      },
    },
  })

  const paymentUrl = paymentUrlFromSession(session)
  if (!paymentUrl) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "ComGate nevrátil platební odkaz.")
  }

  await service.updateGiftVouchers({
    id: voucher.id,
    payment_session_id: (session as any)?.id ?? null,
    payment_url: paymentUrl,
  } as never)

  return { payment_url: paymentUrl, reused: false }
}
