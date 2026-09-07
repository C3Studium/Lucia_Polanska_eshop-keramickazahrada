import { model } from "@medusajs/framework/utils"

/**
 * Dokument, který obchod někde na webu nabízí ke stažení.
 *
 * Jeden řádek = jedno místo na webu, ne jeden soubor. `key` je to místo
 * (`reklamacni-formular`), zbytek popisuje soubor, který v něm zrovna leží.
 * Nahráním nového se řádek přepíše — historie verzí tu nemá co dělat, na
 * stránce vždycky visí jeden platný dokument.
 *
 * Samotný soubor bydlí v úložišti (MinIO) přes běžné `/admin/uploads`; tady
 * je jen adresa a to, co se o něm ukazuje. Duplikovat kvůli tomu úložiště by
 * znamenalo druhé místo, kde se soubory ztrácejí.
 */
export const SiteDocument = model.define("site_document", {
  id: model.id().primaryKey(),
  /** Místo na webu, kam dokument patří. Viz `catalogue.ts`. */
  key: model.text().unique(),
  /** Jak se dokument jmenuje pro zákazníka; katalog dává výchozí. */
  title: model.text(),
  file_url: model.text(),
  file_name: model.text().nullable(),
  mime_type: model.text().nullable(),
  size: model.number().nullable(),
})
