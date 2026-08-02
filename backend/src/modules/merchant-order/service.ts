import { MedusaService } from "@medusajs/framework/utils"
import { MerchantOrderState } from "./models/merchant-order-state"

export default class MerchantOrderModuleService extends MedusaService({
  MerchantOrderState,
}) {}
