import { MedusaService } from "@medusajs/framework/utils"
import VariantPriceSnapshot from "./models/variant-price-snapshot"

class PriceWatchModuleService extends MedusaService({
  VariantPriceSnapshot
}) {}

export default PriceWatchModuleService
