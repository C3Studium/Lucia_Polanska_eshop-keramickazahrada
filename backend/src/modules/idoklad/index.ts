import { Module } from "@medusajs/framework/utils"
import IdokladModuleService from "./service"

export const IDOKLAD_MODULE = "idoklad"

export default Module(IDOKLAD_MODULE, {
  service: IdokladModuleService,
})
