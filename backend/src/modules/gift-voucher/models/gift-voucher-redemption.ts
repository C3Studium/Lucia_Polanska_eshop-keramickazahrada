import { model } from "@medusajs/framework/utils"
import { GiftVoucher } from "./gift-voucher"

/**
 * Jedno uplatnění poukazu — kolik se odečetlo a kde (objednávka, dílna).
 *
 * Neodstraňuje se: vrácení (odstoupení od nákupu zaplaceného poukazem, OP
 * čl. XI) se zapíše jako `reversed_at` a částka se vrátí do zůstatku.
 */
export const GiftVoucherRedemption = model.define("gift_voucher_redemption", {
  id: model.id({ prefix: "gvr" }).primaryKey(),
  voucher: model.belongsTo(() => GiftVoucher, {
    mappedBy: "redemptions",
  }),
  /** Odečtená částka, Kč (kladná). */
  amount: model.number(),
  /** Objednávka z obchodu, je-li; v dílně null. */
  order_id: model.text().nullable(),
  /** „Objednávka #1042", „v dílně — talíř a hrnek"… */
  note: model.text().nullable(),
  reversed_at: model.dateTime().nullable(),
  reverse_note: model.text().nullable(),
})
