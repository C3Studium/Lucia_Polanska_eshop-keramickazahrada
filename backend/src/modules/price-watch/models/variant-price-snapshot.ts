import { model } from "@medusajs/framework/utils"

/**
 * Yesterday's price of a variant somebody has in a wishlist.
 *
 * One row per variant — the job compares "the price we last saw" with "the
 * price now", so history beyond the most recent sighting has no reader.
 * `amount` is money and uses `bigNumber`, the same column type the
 * made-to-order module uses for its amounts.
 */
const VariantPriceSnapshot = model.define("variant_price_snapshot", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  currency_code: model.text(),
  amount: model.bigNumber(),
  product_title: model.text().nullable(),
  captured_at: model.dateTime(),
})
.indexes([
  {
    on: ["variant_id"],
    unique: true
  }
])

export default VariantPriceSnapshot
