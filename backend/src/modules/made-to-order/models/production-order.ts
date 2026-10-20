import { model } from "@medusajs/framework/utils"
import { ProductionPaymentRequest } from "./production-payment-request"

export const ProductionOrder = model.define("production_order", {
  id: model.id().primaryKey(),
  /**
   * Objednávka, ke které zakázka patří. Od 20. 10. 2026 (LEGAL_AUDIT § 0c,
   * Z-A) NE unique: každý zakázkový řádek objednávky je vlastní zakázka.
   * Unikát je `(order_id, line_item_id)` — v migraci, model ho neumí.
   */
  order_id: model.text().index(),
  /**
   * Řádek objednávky (`order_line_item.id`), který tato zakázka vyrábí.
   * NULL = zakázka z doby před 20. 10. 2026 = celá objednávka (legacy):
   * všechny helpery se u ní chovají jako dřív.
   */
  line_item_id: model.text().index().nullable(),
  /** Název položky v okamžiku objednání (řádek se může úpravou odebrat, zakázka musí zůstat čitelná). */
  line_title: model.text().nullable(),
  line_quantity: model.bigNumber().nullable(),
  /**
   * Cena zakázkového řádku po slevě (= to, co zákazník za TUTO položku platí).
   * `original_total` zakázky, která za objednávku NESE dopravu, balné a běžné
   * zboží (první zakázka objednávky), je o ně vyšší; u ostatních se rovná.
   * NULL u legacy řádků — tam je cena položky = `original_total`.
   */
  line_total: model.bigNumber().nullable(),
  /**
   * Kolik z „navíc" nad položku (běžné zboží, poštovné zaplacené v pokladně)
   * nese záloha této zakázky — jen u zakázky nesoucí objednávku, jinak null/0.
   * `deposit_paid − order_extras_paid` = záloha zaplacená za samotnou položku.
   */
  order_extras_paid: model.bigNumber().nullable(),
  stage: model
    .enum([
      "specification_pending",
      "confirmed",
      "in_production",
      "awaiting_balance",
      "ready_to_ship",
      "completed",
      "cancelled",
    ])
    .index()
    .default("specification_pending"),
  /**
   * SMLUVNÍ záloha (LEGAL_AUDIT § 0, Z2/Z5): procento z profilu výroby
   * (přebití u provedení vyhrává), nejvýš 50 — hlídá DB check i API.
   * NENÍ to podíl zaplacený v pokladně (zákazník může zaplatit i celou cenu;
   * co zaplatil, nesou žádosti o platbu). Po zahájení výroby se tahle část
   * nevrací, všechno nad ni ano (Z5).
   */
  deposit_percentage: model.number(),
  /** Smluvní záloha v penězích (měna `currency_code`) — `deposit_percentage` z nezlevněné ceny zakázkových řádků, nejvýš jejich cena. Null u zakázek z doby před 20. 10. 2026. */
  deposit_amount: model.bigNumber().nullable(),
  agreed_total: model.bigNumber().nullable(),
  // Příplatek — vlastní částka navíc nad domluvenou/původní cenu (např. víc práce,
  // než se čekalo). Vlastní „entita" vedle ceny: cenu nemění, jen navyšuje, co
  // zákazník dluží (outstanding = (agreed_total ?? original_total) + surcharge − paid).
  surcharge: model.bigNumber().nullable(),
  original_total: model.bigNumber(),
  currency_code: model.text(),
  estimated_completion_at: model.dateTime().nullable(),
  specification_confirmed_at: model.dateTime().nullable(),
  production_started_at: model.dateTime().nullable(),
  /**
   * Z3: zahájení výroby platí od e-mailu „Zakázka je ve výrobě", ne od
   * tvrzení kterékoli strany. Kdy odešel a ID zprávy (notifikace / Resend).
   * Dokud je null, zrušení zákazníkem = před zahájením (Z4, vrací se vše).
   */
  production_start_notified_at: model.dateTime().nullable(),
  production_start_email_id: model.text().nullable(),
  production_completed_at: model.dateTime().nullable(),
  balance_requested_at: model.dateTime().nullable(),
  final_total_confirmed_at: model.dateTime().nullable(),
  ready_to_ship_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  /**
   * Zakázka zrušená (stage `cancelled`) — kdy. Fáze sama datum nenese a
   * průběh žádosti v Reklamace a zrušení (docs/reklamace-a-zruseni.md §12.5)
   * ho u kroku „Zakázka zrušena" ukazuje.
   */
  cancelled_at: model.dateTime().nullable(),
  /** Kdo zakázku zrušil: `customer` (Z4/Z5/Z6) nebo `seller` (Z7). Text + DB check, ne enum — ať nullable sloupec nepotřebuje výchozí hodnotu. */
  cancelled_by: model.text().nullable(),
  /** `before_production` = před e-mailem Z3 (vrací se vše), `after_production` = po něm (záloha se nevrací). */
  cancellation_phase: model.text().nullable(),
  /** Kolik se při zrušení vrátilo (vše, nebo jen nad zálohu). */
  cancellation_refund_amount: model.bigNumber().nullable(),
  /**
   * Z11: PDF „Potvrzení zakázky" — neměnný doklad k objednávce v R2
   * (`orders/<order_id>/potvrzeni-zakazky.pdf`), jeho otisk a veřejná URL,
   * kdy odešlo zákazníkovi a s jakou verzí OP se tisklo.
   */
  confirmation_pdf_key: model.text().nullable(),
  confirmation_pdf_sha256: model.text().nullable(),
  confirmation_pdf_url: model.text().nullable(),
  confirmation_sent_at: model.dateTime().nullable(),
  confirmation_terms_version: model.text().nullable(),
  /**
   * Kolik ze zaplacené zálohy už bylo vráceno přes Reklamace a zrušení
   * (`scope: "deposit"`, §12.3). Rozhodnutí majitelky — zákazník na vrácení
   * zálohy u zakázky nemá nárok (§1837 písm. d). Null = nic.
   */
  deposit_refunded: model.bigNumber().nullable(),
  deposit_refunded_at: model.dateTime().nullable(),
  customer_note: model.text().nullable(),
  internal_note: model.text().nullable(),
  payment_requests: model.hasMany(() => ProductionPaymentRequest, {
    mappedBy: "production_order",
  }),
})
