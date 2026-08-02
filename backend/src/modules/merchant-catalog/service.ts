import { MedusaService } from "@medusajs/framework/utils"
import { CollectionCategoryAssignment } from "./models/collection-category-assignment"
import { CollectionProfile } from "./models/collection-profile"
import { SeasonalSelection } from "./models/seasonal-selection"
import { SeasonalSelectionItem } from "./models/seasonal-selection-item"

export default class MerchantCatalogModuleService extends MedusaService({
  CollectionProfile,
  CollectionCategoryAssignment,
  SeasonalSelection,
  SeasonalSelectionItem,
}) {}
