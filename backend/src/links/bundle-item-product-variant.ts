import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import BundledProductsModule from "../modules/bundled-product"

export default defineLink(
  BundledProductsModule.linkable.bundleItem,
  ProductModule.linkable.productVariant
)
