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
  // Jedno odeslání = JEDEN řádek = jedna zpráva. Víc fotek (až 6) z jednoho
  // odeslání jde do `images` (pole URL), ne po řádku. Dřív to bylo N řádků
  // slepovaných přes `batch_id` — to se v praxi nezapisovalo (NULL) a vlákno
  // se tím rozpadalo na N zpráv. Teď je zpráva atomická: jeden řádek nese text
  // i všechny své fotky.
  images: model.json().nullable(),
  // Pozůstatek po jedné-fotce-na-řádek. Nové zápisy ho plní první fotkou kvůli
  // zpětné čitelnosti; čtení bere `images`, a když chybí, spadne na `image_url`
  // (staré řádky). `batch_id` zůstává jen aby se nemusela měnit stará migrace;
  // nová logika ho nepoužívá.
  image_url: model.text().nullable(),
  visible_to_customer: model.boolean().default(false),
  created_by: model.text().nullable(),
  batch_id: model.text().nullable(),
})
