import { Module } from "@medusajs/framework/utils"
import PriceWatchModuleService from "./service"

export const PRICE_WATCH_MODULE = "priceWatch"

export default Module(PRICE_WATCH_MODULE, {
  service: PriceWatchModuleService
})
