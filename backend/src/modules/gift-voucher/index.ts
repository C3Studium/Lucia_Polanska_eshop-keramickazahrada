import { Module } from "@medusajs/framework/utils"
import GiftVoucherModuleService from "./service"

export const GIFT_VOUCHER_MODULE = "giftVoucher"

export default Module(GIFT_VOUCHER_MODULE, {
  service: GiftVoucherModuleService,
})
