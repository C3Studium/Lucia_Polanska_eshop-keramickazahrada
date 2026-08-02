import { Module } from "@medusajs/framework/utils"
import MerchantOrderModuleService from "./service"

export const MERCHANT_ORDER_MODULE = "merchantOrder"

export default Module(MERCHANT_ORDER_MODULE, {
  service: MerchantOrderModuleService,
})
