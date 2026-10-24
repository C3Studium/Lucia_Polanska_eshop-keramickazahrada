import { model } from "@medusajs/framework/utils"
import { GiftVoucherRedemption } from "./gift-voucher-redemption"

/**
 * Dárkový poukaz — jeden kus s vlastním kódem (OP čl. XI).
 *
 * Vzniká v administraci (stránka Poukazy): Lucie ho vystaví na jméno
 * obdarovaného, zapíše kupujícího a buď rovnou označí jako zaplacený (hotově,
 * převodem), nebo kupujícímu pošle platební odkaz ComGate. Platba přes odkaz
 * jde stejnou cestou jako kurzy (`lib/gift-voucher-payment.ts`): samostatná
 * platební kolekce → relace → ověřené oznámení / dohled → `payment.captured`
 * → `subscribers/gift-voucher-payment.ts` označí poukaz jako zaplacený.
 *
 * Částky jsou celé koruny (`number`), ne `bigNumber`: poukaz se vystavuje na
 * kulatou částku a zůstatek se mění jen odečtením uplatněné částky.
 *
 * `balance` je uložená kopie „hodnota − neodvolaná uplatnění" — mění ji jen
 * service (`redeem` / `reverseRedemption`) v jedné transakci s řádkem
 * uplatnění, takže se nemůže rozejít s historií.
 */
export const GiftVoucher = model.define("gift_voucher", {
  id: model.id({ prefix: "gv" }).primaryKey(),
  /** Kód na poukazu, např. KZ-7HQ4-M2XP. Jedinečný, bez zaměnitelných znaků. */
  code: model.text().unique(),
  /** Vytištěný (poštou / v dílně) nebo elektronický (e-mailem). */
  kind: model.enum(["physical", "electronic"]).default("physical"),
  /** Hodnota při vystavení, Kč. */
  initial_value: model.number(),
  /** Zbývá k uplatnění, Kč. */
  balance: model.number(),
  currency_code: model.text().default("czk"),
  /** Do kdy platí (včetně tohoto dne). */
  valid_until: model.dateTime(),
  /** Obdarovaný — „na jméno". */
  recipient_name: model.text().nullable(),
  /** Kam poslat elektronický poukaz (obdarovanému); bez něj jde kupujícímu. */
  recipient_email: model.text().nullable(),
  /** Věnování na poukaz („Babičce k narozeninám…"). */
  dedication: model.text().nullable(),
  buyer_name: model.text(),
  buyer_email: model.text().nullable(),
  buyer_phone: model.text().nullable(),
  /** Interní poznámka majitelky — zákazník ji nevidí. */
  note: model.text().nullable(),
  /** Jak se platí: hotově, převodem, online odkazem, nebo objednávkou v obchodě. */
  payment_method: model.enum(["cash", "transfer", "comgate", "order"]),
  payment_status: model.enum(["pending", "paid"]).index().default("pending"),
  paid_at: model.dateTime().nullable(),
  payment_collection_id: model.text().nullable(),
  payment_session_id: model.text().index().nullable(),
  payment_url: model.text().nullable(),
  /** Objednávka z obchodu, kterou byl poukaz koupený (poukaz jako výrobek). */
  order_id: model.text().index().nullable(),
  /**
   * Položka té objednávky + pořadí kusu (`{line_item_id}#{n}`) — kus koupený
   * v obchodě vznikne právě jednou, i když událost objednávky přijde dvakrát.
   */
  order_line_item_id: model.text().index().nullable(),
  /** Slevový kód v modulu akcí (kód = `code`), přes který se poukaz uplatní v košíku. */
  promotion_id: model.text().nullable(),
  /** Zrušený poukaz nejde uplatnit; historie zůstává. */
  status: model.enum(["active", "cancelled"]).index().default("active"),
  cancelled_at: model.dateTime().nullable(),
  /**
   * Peníze za poukaz se vrátily (odstoupení, vrácení objednávky, ruční
   * vrácení) — poukaz je tím spotřebovaný a nejde ho už uplatnit, ani obnovit.
   */
  refunded_at: model.dateTime().nullable(),
  refund_note: model.text().nullable(),
  /** Kdy naposledy odešel poukaz e-mailem a komu. */
  sent_at: model.dateTime().nullable(),
  sent_to: model.text().nullable(),
  redemptions: model.hasMany(() => GiftVoucherRedemption, {
    mappedBy: "voucher",
  }),
})
