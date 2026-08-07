import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import DobirkaPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [DobirkaPaymentService],
})
