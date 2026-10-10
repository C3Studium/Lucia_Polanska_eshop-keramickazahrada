import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261010120000 extends Migration {

  override async up(): Promise<void> {
    // Reklamace a zrušení §12 (docs/reklamace-a-zruseni.md): záloha zakázky
    // vrácená přes modul (`deposit_refunded`, bigNumber → numeric + raw_* jsonb)
    // a datum zrušení zakázky pro krok „Zakázka zrušena" v průběhu žádosti.
    this.addSql(`alter table if exists "production_order" add column if not exists "deposit_refunded" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_deposit_refunded" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "deposit_refunded_at" timestamptz null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "cancelled_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_order" drop column if exists "deposit_refunded";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "raw_deposit_refunded";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "deposit_refunded_at";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "cancelled_at";`);
  }

}
