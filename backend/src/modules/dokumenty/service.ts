import { MedusaService } from "@medusajs/framework/utils"

import { SiteDocument } from "./models/site-document"

export default class DokumentyModuleService extends MedusaService({
  SiteDocument,
}) {}
