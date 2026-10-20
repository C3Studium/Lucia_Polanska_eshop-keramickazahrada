import { MedusaService } from "@medusajs/framework/utils"
import PriceHistoryEntry from "./models/price-history-entry"

/**
 * Historie cen pro § 12a. Zapisuje ji job `record-price-history`, čte
 * `GET /store/price-history/reference`; výpočet nejnižší ceny je čistá funkce
 * v `lib/price-reference.ts`, ať se dá dokázat unit testem.
 */
class PriceHistoryModuleService extends MedusaService({
  PriceHistoryEntry,
}) {}

export default PriceHistoryModuleService
