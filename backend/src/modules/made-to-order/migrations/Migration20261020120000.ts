import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Zakázky podle LEGAL_AUDIT.md § 0 (20. 10. 2026, pravidla Z1–Z12):
 *
 * - Z2: záloha nejvýš 50 % — DB check na profilu, na zakázce i na přebití
 *   u provedení (ověřeno před migrací: na produkci žádný řádek > 50).
 * - Z3: zahájení výroby platí od e-mailu „Zakázka je ve výrobě" —
 *   `production_start_notified_at` + ID zprávy.
 * - Z4/Z5/Z7: zrušení — kdo, v jaké fázi, kolik se vrátilo nad zálohu.
 * - Z5: `deposit_amount` = SMLUVNÍ záloha v penězích (z profilu, ≤ 50 %),
 *   ne to, co zákazník zaplatil v pokladně (to nesou žádosti o platbu).
 *   `deposit_percentage` od teď znamená totéž v procentech.
 * - Z11: PDF „Potvrzení zakázky" u objednávky (klíč v R2, otisk, URL, kdy
 *   odešlo, s jakou verzí OP).
 */
export class Migration20261020120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "production_order" add column if not exists "production_start_notified_at" timestamptz null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "production_start_email_id" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "cancelled_by" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "cancellation_phase" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "cancellation_refund_amount" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_cancellation_refund_amount" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "deposit_amount" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_deposit_amount" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "confirmation_pdf_key" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "confirmation_pdf_sha256" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "confirmation_pdf_url" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "confirmation_sent_at" timestamptz null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "confirmation_terms_version" text null;`);

    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_cancelled_by_check";`);
    this.addSql(`alter table if exists "production_order" add constraint "production_order_cancelled_by_check" check ("cancelled_by" is null or "cancelled_by" in ('customer', 'seller'));`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_cancellation_phase_check";`);
    this.addSql(`alter table if exists "production_order" add constraint "production_order_cancellation_phase_check" check ("cancellation_phase" is null or "cancellation_phase" in ('before_production', 'after_production'));`);

    // Z2 — strop zálohy 50 %. Kdyby někde byl řádek nad 50, migrace spadne
    // (--all-or-nothing) a data se musí nejdřív rozhodnout ručně.
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_deposit_percentage_check";`);
    this.addSql(`alter table if exists "production_order" add constraint "production_order_deposit_percentage_check" check ("deposit_percentage" between 1 and 50);`);
    this.addSql(`alter table if exists "product_production_profile" drop constraint if exists "product_production_profile_default_deposit_percentage_check";`);
    this.addSql(`alter table if exists "product_production_profile" add constraint "product_production_profile_default_deposit_percentage_check" check ("default_deposit_percentage" between 1 and 50);`);
    this.addSql(`alter table if exists "variant_production_profile" drop constraint if exists "variant_production_profile_deposit_percentage_override_check";`);
    this.addSql(`alter table if exists "variant_production_profile" add constraint "variant_production_profile_deposit_percentage_override_check" check ("deposit_percentage_override" is null or "deposit_percentage_override" between 1 and 50);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "variant_production_profile" drop constraint if exists "variant_production_profile_deposit_percentage_override_check";`);
    this.addSql(`alter table if exists "product_production_profile" drop constraint if exists "product_production_profile_default_deposit_percentage_check";`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_deposit_percentage_check";`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_cancellation_phase_check";`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_cancelled_by_check";`);
    for (const column of [
      "confirmation_terms_version",
      "confirmation_sent_at",
      "confirmation_pdf_url",
      "confirmation_pdf_sha256",
      "confirmation_pdf_key",
      "raw_deposit_amount",
      "deposit_amount",
      "raw_cancellation_refund_amount",
      "cancellation_refund_amount",
      "cancellation_phase",
      "cancelled_by",
      "production_start_email_id",
      "production_start_notified_at",
    ]) {
      this.addSql(`alter table if exists "production_order" drop column if exists "${column}";`);
    }
  }

}
