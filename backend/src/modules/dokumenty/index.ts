import { Module } from "@medusajs/framework/utils"

import DokumentyModuleService from "./service"

export const DOKUMENTY_MODULE = "dokumenty"

export default Module(DOKUMENTY_MODULE, {
  service: DokumentyModuleService,
})
