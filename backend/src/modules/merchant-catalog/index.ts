import { Module } from "@medusajs/framework/utils"
import MerchantCatalogModuleService from "./service"

export const MERCHANT_CATALOG_MODULE = "merchantCatalog"

export default Module(MERCHANT_CATALOG_MODULE, {
  service: MerchantCatalogModuleService,
})
