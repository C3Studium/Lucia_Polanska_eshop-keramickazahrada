import { Module } from "@medusajs/framework/utils"
import MadeToOrderModuleService from "./service"

export const MADE_TO_ORDER_MODULE = "madeToOrder"

export default Module(MADE_TO_ORDER_MODULE, {
  service: MadeToOrderModuleService,
})
