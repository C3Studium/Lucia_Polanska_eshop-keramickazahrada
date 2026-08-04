import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PickupPaymentService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PickupPaymentService],
})
