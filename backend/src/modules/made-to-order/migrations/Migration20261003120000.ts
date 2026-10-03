import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261003120000 extends Migration {

  override async up(): Promise<void> {
    // surcharge (příplatek) — bigNumber → numeric + raw_surcharge jsonb, nullable.
    this.addSql(`alter table if exists "production_order" add column if not exists "surcharge" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_surcharge" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_order" drop column if exists "surcharge";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "raw_surcharge";`);
  }

}
