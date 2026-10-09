import { MedusaService } from "@medusajs/framework/utils"
import ParcelTracking from "./models/parcel-tracking"

export default class ParcelTrackingModuleService extends MedusaService({
  ParcelTracking,
}) {}
