import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { paymentStatusFromProvider } from "../lib/payment-provider-status"

/**
 * Dohled nad platbami poukazů — totéž co `reconcile-course-payments`
 * (tam je celé zdůvodnění): když oznámení od ComGate nedorazí (prázdná
 * notifikační adresa v portálu, výpadek), zeptá se brány sám a pustí tutéž
 * `processPaymentWorkflow`. Zbytek (zaplaceno, e-mail s poukazem, zpráva
 * majitelce) obstará idempotentní `subscribers/gift-voucher-payment.ts`.
 */
const HOTOVO = ["captured", "authorized"]

export default async function reconcileGiftVoucherPayments(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const paymentModule = container.resolve(Modules.PAYMENT)

  const open = ((await service.listGiftVouchers({
    payment_status: "pending",
    payment_method: "comgate",
    status: "active",
  } as never)) as any[]).filter((v) => v.payment_session_id)

  for (const voucher of open) {
    try {
      const [session] = await paymentModule.listPaymentSessions({ id: voucher.payment_session_id } as never)
      if (!session) continue
      const result = await paymentStatusFromProvider(container, session as any)
      const status = String(result?.status ?? "").toLowerCase()
      if (!HOTOVO.includes(status)) continue
      await processPaymentWorkflow(container).run({
        input: {
          action: "captured",
          data: { session_id: voucher.payment_session_id, amount: Number(voucher.initial_value) },
        } as never,
      })
      logger.info(`[poukazy] Dohled srovnal platbu poukazu ${voucher.code} — ComGate hlásí ${status}.`)
    } catch (error) {
      logger.warn(
        `[poukazy] Platbu poukazu ${voucher.code} se nepodařilo ověřit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }
}

export const config = {
  name: "reconcile-gift-voucher-payments",
  schedule: "*/10 * * * *",
}
