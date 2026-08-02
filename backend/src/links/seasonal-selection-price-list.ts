import { defineLink } from "@medusajs/framework/utils"
import PricingModule from "@medusajs/medusa/pricing"
import MerchantCatalogModule from "../modules/merchant-catalog"

export default defineLink(
  {
    linkable: MerchantCatalogModule.linkable.seasonalSelection.id,
    field: "linked_price_list_id",
  },
  PricingModule.linkable.priceList,
  { readOnly: true }
)
