import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Dárkové poukazy (stránka Poukazy v administraci, OP čl. XI).
 *
 * Do teď byl poukaz jen výrobek v obchodě a kód, zůstatek i uplatnění si
 * Lucie psala ručně na papír. Nově má každý poukaz řádek s kódem, hodnotou,
 * zůstatkem, platností, obdarovaným a kupujícím, a každé uplatnění vlastní
 * řádek — zůstatek se tak dá kdykoli dohledat i vrátit.
 *
 * Psáno ručně (generátor nedosáhne na databázi na Railway) a idempotentně,
 * jako ostatní migrace v repu.
 */
export class Migration20261024150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "gift_voucher" ("id" text not null, "code" text not null, "kind" text check ("kind" in ('physical', 'electronic')) not null default 'physical', "initial_value" integer not null, "balance" integer not null, "currency_code" text not null default 'czk', "valid_until" timestamptz not null, "recipient_name" text null, "recipient_email" text null, "dedication" text null, "buyer_name" text not null, "buyer_email" text null, "buyer_phone" text null, "note" text null, "payment_method" text check ("payment_method" in ('cash', 'transfer', 'comgate', 'order')) not null, "payment_status" text check ("payment_status" in ('pending', 'paid')) not null default 'pending', "paid_at" timestamptz null, "payment_collection_id" text null, "payment_session_id" text null, "payment_url" text null, "order_id" text null, "status" text check ("status" in ('active', 'cancelled')) not null default 'active', "cancelled_at" timestamptz null, "sent_at" timestamptz null, "sent_to" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gift_voucher_pkey" primary key ("id"));`);
    // Poukaz jako slevový kód + kus koupený v obchodě (24. 10. odpoledne).
    this.addSql(`alter table if exists "gift_voucher" add column if not exists "order_line_item_id" text null;`);
    this.addSql(`alter table if exists "gift_voucher" add column if not exists "promotion_id" text null;`);
    // Vrácené peníze = spotřebovaný poukaz (25. 10.).
    this.addSql(`alter table if exists "gift_voucher" add column if not exists "refunded_at" timestamptz null;`);
    this.addSql(`alter table if exists "gift_voucher" add column if not exists "refund_note" text null;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_voucher_order_line_item_id" ON "gift_voucher" ("order_line_item_id") WHERE deleted_at IS NULL AND order_line_item_id IS NOT NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_voucher_code_unique" ON "gift_voucher" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_payment_status" ON "gift_voucher" ("payment_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_payment_session_id" ON "gift_voucher" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_order_id" ON "gift_voucher" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_status" ON "gift_voucher" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_deleted_at" ON "gift_voucher" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "gift_voucher_redemption" ("id" text not null, "voucher_id" text not null, "amount" integer not null, "order_id" text null, "note" text null, "reversed_at" timestamptz null, "reverse_note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gift_voucher_redemption_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_redemption_voucher_id" ON "gift_voucher_redemption" ("voucher_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_voucher_redemption_deleted_at" ON "gift_voucher_redemption" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_voucher_redemption_voucher_id_foreign') THEN ALTER TABLE "gift_voucher_redemption" ADD CONSTRAINT "gift_voucher_redemption_voucher_id_foreign" FOREIGN KEY ("voucher_id") REFERENCES "gift_voucher" ("id") ON UPDATE CASCADE ON DELETE CASCADE; END IF; END $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "gift_voucher_redemption" cascade;`);
    this.addSql(`drop table if exists "gift_voucher" cascade;`);
  }

}
