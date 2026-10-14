import { Module } from "@medusajs/framework/utils"
import PriceHistoryModuleService from "./service"

export const PRICE_HISTORY_MODULE = "priceHistory"

export default Module(PRICE_HISTORY_MODULE, {
  service: PriceHistoryModuleService,
})
