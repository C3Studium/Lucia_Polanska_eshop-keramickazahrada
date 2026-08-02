import { MedusaService } from "@medusajs/framework/utils"
import { ProductProductionProfile } from "./models/product-production-profile"
import { ProductionOrder } from "./models/production-order"
import { ProductionPaymentRequest } from "./models/production-payment-request"
import { VariantProductionProfile } from "./models/variant-production-profile"

export default class MadeToOrderModuleService extends MedusaService({
  ProductProductionProfile,
  VariantProductionProfile,
  ProductionOrder,
  ProductionPaymentRequest,
}) {}
