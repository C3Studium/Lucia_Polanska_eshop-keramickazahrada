import { model } from "@medusajs/framework/utils"

/**
 * One entry in a zakázka's diary — a photo, a note, or both.
 *
 * Keyed by the Medusa order id (like the production order itself), because
 * every surface that opens the diary — Zakázky, the Objednávky+ expansion,
 * the customer's order page — already holds that id.
 *
 * `visible_to_customer` is per entry, default off: the diary is her working
 * notebook first („kobalt 2×, výpal 1240 °C"), and a window for the customer
 * second. Opting individual entries in keeps glaze recipes private while the
 * pretty photo travels.
 */
export const ProductionNote = model.define("production_note", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  text: model.text().nullable(),
  image_url: model.text().nullable(),
  visible_to_customer: model.boolean().default(false),
  created_by: model.text().nullable(),
})
