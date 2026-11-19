import { model } from "@medusajs/framework/utils"

/**
 * Jeden GIF návodu. `key` je stejný klíč jako v katalogu textů (např.
 * `produkt.sleva`, `obchod.prihlaseni`); `area` říká, kdo ho smí číst —
 * `store` vrací i veřejné API obchodu, `admin` jen admin.
 * Soubor leží v úložišti souborů (R2), `file_id` je kvůli smazání starého
 * klipu při přetočení.
 */
const NavodKlip = model
  .define("navod_klip", {
    id: model.id().primaryKey(),
    key: model.text(),
    area: model.text(),
    url: model.text(),
    file_id: model.text().nullable(),
    width: model.number().nullable(),
    height: model.number().nullable(),
    bytes: model.number().nullable(),
  })
  .indexes([{ on: ["key"], unique: true }, { on: ["area"] }])

export default NavodKlip
