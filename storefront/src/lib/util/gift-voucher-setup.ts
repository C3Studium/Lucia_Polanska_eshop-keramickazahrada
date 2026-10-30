/**
 * Je dárkový poukaz v košíku nastavený?
 *
 * Od 30. 10. 2026 se poukaz přidává do košíku holý: stránka produktu nabízí
 * jen „Přidat do košíku" a hodnotu, podobu i obdarovaného zvolí zákazník až
 * v košíku, vedle souhrnu. Dokud to neudělá, košík k pokladně nepustí.
 *
 * ZRCADLÍ `giftVoucherSetupProblem` v `backend/src/lib/voucher.ts` — ten
 * rozhoduje (brána před dokončením košíku), tohle je jen pro to, aby zákazník
 * nenarazil až u platby. Čistý modul bez „use client": čte z něj i košík
 * vykreslovaný na serveru.
 */

import {
  VOUCHER_LINE_KEYS,
  isGiftVoucherProduct,
  isValidVoucherEmail,
  type VoucherKind,
} from "./gift-voucher-code"
import { checkVoucherAmount, isCustomAmountVoucher, voucherConfig } from "./voucher-amount"

export const VOUCHER_AMOUNT_KEY = "voucher_amount"

type VoucherLineLike = {
  id?: string
  metadata?: Record<string, unknown> | null
  product?: { metadata?: Record<string, unknown> | null } | null
}

type CartLike = {
  currency_code?: string | null
  items?: VoucherLineLike[] | null
}

/** Je ten řádek dárkový poukaz PODLE PRODUKTU (ne podle vyplněných metadat)? */
export const isGiftVoucherProductLine = (item: VoucherLineLike | null | undefined): boolean =>
  isGiftVoucherProduct(item?.product?.metadata)

export const voucherLineKind = (
  item: VoucherLineLike | null | undefined
): VoucherKind | null => {
  const kind = item?.metadata?.[VOUCHER_LINE_KEYS.kind]
  return kind === "electronic" || kind === "physical" ? kind : null
}

/** Zvolená hodnota poukazu, nebo `null`, dokud ji zákazník nezadal. */
export const voucherLineAmount = (item: VoucherLineLike | null | undefined): number | null => {
  const raw = item?.metadata?.[VOUCHER_AMOUNT_KEY]
  if (raw === undefined || raw === null || String(raw).trim() === "") return null
  const amount = Number(raw)
  return Number.isFinite(amount) ? amount : null
}

/**
 * Chybí na poukazu ještě něco? Vrací `true`, dokud zákazník nezvolil podobu
 * a (u poukazu s vlastní částkou) platnou hodnotu. Řádky, které poukaz nejsou,
 * vrací `false`.
 */
export const voucherLineNeedsSetup = (
  item: VoucherLineLike | null | undefined,
  currencyCode?: string | null
): boolean => {
  if (!isGiftVoucherProductLine(item)) return false
  if (!voucherLineKind(item)) return true

  const email = String(item?.metadata?.[VOUCHER_LINE_KEYS.recipientEmail] ?? "").trim()
  if (email && !isValidVoucherEmail(email)) return true

  const productMetadata = item?.product?.metadata
  if (!isCustomAmountVoucher(productMetadata)) return false

  const amount = voucherLineAmount(item)
  if (amount === null) return true
  return !checkVoucherAmount(
    String(amount),
    voucherConfig(productMetadata),
    currencyCode || "czk"
  ).ok
}

/** Poukazy v košíku — v pořadí, v jakém v něm leží. */
export const giftVoucherLinesOf = (cart: CartLike | null | undefined): VoucherLineLike[] =>
  (cart?.items ?? []).filter(isGiftVoucherProductLine)

/** Je v košíku poukaz, který ještě není nastavený? Pak se k pokladně nesmí. */
export const cartNeedsVoucherSetup = (cart: CartLike | null | undefined): boolean =>
  giftVoucherLinesOf(cart).some((item) => voucherLineNeedsSetup(item, cart?.currency_code))

/** Kotva panelu pod souhrnem — zamčené tlačítko na něj odkazuje. */
export const GIFT_VOUCHER_SETUP_ID = "nastaveni-poukazu"

/** Věta nad zamčeným tlačítkem k pokladně. */
export const VOUCHER_SETUP_BLOCK_NOTE =
  "Nejdřív prosím nastavte dárkový poukaz — hodnotu a podobu zvolíte pod souhrnem."
