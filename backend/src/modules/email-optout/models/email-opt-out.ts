import { model } from "@medusajs/framework/utils"

/**
 * Námitka proti jednomu druhu e-mailů z oprávněného zájmu — jedním kliknutím
 * z patičky e-mailu (§ 7 odst. 3 zákona č. 480/2004 Sb., čl. 21 GDPR).
 *
 * Jeden řádek = jedna adresa a jeden druh (`review_request`, `price_drop`,
 * `abandoned_cart` — `lib/email-optout.ts`). Druh je text, ne enum: další
 * druh e-mailu pak nepotřebuje migraci, platné hodnoty hlídá kód.
 *
 * `email` je normalizovaný (`normalizeEmail`, malá písmena bez mezer), takže
 * odkaz, řádek i dotaz jobu se shodnou. Unikátní (email, kind) dělá z
 * opakovaného kliknutí no-op. Řádek se nemaže — námitka trvá, dokud ji
 * zákazník sám neodvolá (to dnes jde jen ručně).
 */
const EmailOptOut = model
  .define("email_opt_out", {
    id: model.id().primaryKey(),
    email: model.text(),
    kind: model.text(),
  })
  .indexes([
    {
      on: ["email", "kind"],
      unique: true,
    },
    {
      on: ["email"],
    },
  ])

export default EmailOptOut
