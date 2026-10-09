import { Module } from "@medusajs/framework/utils"
import ParcelTrackingModuleService from "./service"

export const PARCEL_TRACKING_MODULE = "parcelTracking"

export default Module(PARCEL_TRACKING_MODULE, {
  service: ParcelTrackingModuleService,
})
