import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { VOUCHER_CAMPAIGN_PREFIX, formatVoucherCode, voucherState } from "../modules/gift-voucher/code"

/**
 * Poukaz jako slevový kód.
 *
 * Každý zaplacený a platný poukaz má v modulu akcí Medusy vlastní akci:
 * kód = kód poukazu, pevná částka na objednávku = **aktuální zůstatek**,
 * vlastní kampaň `gift-voucher-{kód}` s koncem = koncem platnosti poukazu
 * (Medusa sama odmítne propadlý kód a `/store/promotions/:code` řekne
 * „vypršela"). Zákazník ho tedy zadá do téhož pole jako slevový kód
 * a částka se odečte nativním výpočtem akcí — v košíku, pokladně, platbě
 * i objednávce sedí jedno číslo.
 *
 * Zdroj pravdy o penězích je pořád tabulka poukazů; akce je jen její zrcadlo
 * a tahle funkce ho srovnává po KAŽDÉ změně (zaplacení, uplatnění, vrácení,
 * zrušení, prodloužení). Je idempotentní — volat ji navíc nic nerozbije.
 *
 * Co Medusa nedovolí a obchod to tak přiznává (OP čl. XI): slevová akce
 * dopadá jen na zboží, které smí dostat slevu (`is_discountable`), tedy ne na
 * kusy ve slevě / výprodeji / s „Bez slev. kódů" a ne na poštovné. Takový
 * zbytek zákazník doplatí, nebo ho Lucie z poukazu uplatní ručně v administraci.
 */
export const syncVoucherPromotion = async (container: MedusaContainer, voucherId: string): Promise<void> => {
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const promotionModule = container.resolve(Modules.PROMOTION) as any
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const [voucher] = (await service.listGiftVouchers({ id: voucherId } as never)) as any[]
  if (!voucher) return

  const usable = voucherState(voucher) === "active"
  const balance = Math.max(0, Math.round(Number(voucher.balance)))

  let promotion: any = null
  if (voucher.promotion_id) {
    ;[promotion] = await promotionModule.listPromotions(
      { id: voucher.promotion_id },
      { relations: ["application_method", "campaign"] }
    )
  }
  if (!promotion) {
    // Akce mohla vzniknout dřív, než se id stihlo uložit (pád uprostřed).
    ;[promotion] = await promotionModule.listPromotions(
      { code: voucher.code },
      { relations: ["application_method", "campaign"] }
    )
  }

  if (!usable) {
    if (promotion && promotion.status === "active") {
      await promotionModule.updatePromotions([{ id: promotion.id, status: "inactive" }])
    }
    if (promotion && voucher.promotion_id !== promotion.id) {
      await service.updateGiftVouchers({ id: voucher.id, promotion_id: promotion.id } as never)
    }
    return
  }

  const endsAt = new Date(voucher.valid_until)

  if (!promotion) {
    const [created] = await promotionModule.createPromotions([
      {
        code: voucher.code,
        type: "standard",
        status: "active",
        is_automatic: false,
        is_tax_inclusive: true,
        application_method: {
          type: "fixed",
          target_type: "order",
          allocation: "across",
          value: balance,
          currency_code: voucher.currency_code || "czk",
        },
        campaign: {
          name: `Dárkový poukaz ${formatVoucherCode(voucher.code)}`,
          campaign_identifier: `${VOUCHER_CAMPAIGN_PREFIX}${voucher.code}`,
          starts_at: new Date(voucher.paid_at || voucher.created_at || Date.now()),
          ends_at: endsAt,
        },
      },
    ])
    await service.updateGiftVouchers({ id: voucher.id, promotion_id: created.id } as never)
    logger.info(`[poukazy] Poukaz ${voucher.code} je teď slevový kód na ${balance} Kč.`)
    return
  }

  const currentValue = Number(promotion.application_method?.value ?? NaN)
  if (promotion.status !== "active" || currentValue !== balance) {
    await promotionModule.updatePromotions([
      { id: promotion.id, status: "active", application_method: { value: balance } },
    ])
  }
  const campaignEnd = promotion.campaign?.ends_at ? new Date(promotion.campaign.ends_at).getTime() : null
  if (promotion.campaign?.id && campaignEnd !== endsAt.getTime()) {
    await promotionModule.updateCampaigns([{ id: promotion.campaign.id, ends_at: endsAt }])
  }
  if (voucher.promotion_id !== promotion.id) {
    await service.updateGiftVouchers({ id: voucher.id, promotion_id: promotion.id } as never)
  }
}

/** Jako `syncVoucherPromotion`, ale nikdy nevyhodí — volá se jako dozvuk jiné akce. */
export const syncVoucherPromotionSafe = async (container: MedusaContainer, voucherId: string): Promise<void> => {
  try {
    await syncVoucherPromotion(container, voucherId)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`[poukazy] Slevový kód poukazu ${voucherId} se nepodařilo srovnat: ${(error as Error)?.message ?? error}`)
  }
}
