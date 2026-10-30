import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261030120000 extends Migration {

  override async up(): Promise<void> {
    // Poštovné a balné domluvené u ceny po domluvě — bigNumber → numeric
    // + raw_* jsonb, nullable (stejný tvar jako surcharge).
    this.addSql(`alter table if exists "production_order" add column if not exists "shipping_total" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_shipping_total" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "packaging_total" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_packaging_total" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_order" drop column if exists "shipping_total";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "raw_shipping_total";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "packaging_total";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "raw_packaging_total";`);
  }

}
