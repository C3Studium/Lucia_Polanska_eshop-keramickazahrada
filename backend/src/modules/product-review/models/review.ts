import { model } from "@medusajs/framework/utils"

const Review = model.define("review", {
  id: model.id().primaryKey(),
  title: model.text().nullable(),
  content: model.text(),
  rating: model.float(),
  first_name: model.text(),
  last_name: model.text(),
  /**
   * „archivováno" is a fourth state rather than a derived one: a review she has
   * dealt with and does not want in front of her again is a decision, and
   * deriving it from age would give her a tab she cannot control.
   */
  status: model
    .enum(["čeká na schválení", "schváleno", "zamítnuto", "archivováno"])
    .default("čeká na schválení"),
  product_id: model.text().index("IDX_REVIEW_PRODUCT_ID"),
  customer_id: model.text().nullable()
})
.checks([
  {
    name: "rating_range", 
    expression: (columns) => `${columns.rating} >= 1 AND ${columns.rating} <= 5`
  }
])

export default Review
