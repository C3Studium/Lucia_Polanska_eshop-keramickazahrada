import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221509 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "bundle" add column if not exists "pricing_mode" text check ("pricing_mode" in ('component_sum', 'component_sum_discount', 'fixed_price')) not null default 'component_sum', add column if not exists "discount_percentage" integer null;`);

    this.addSql(`alter table if exists "bundle_item" add column if not exists "display_order" integer not null default 0, add column if not exists "variant_mode" text check ("variant_mode" in ('customer_selects', 'fixed_variant')) not null default 'customer_selects';`);
    this.addSql(`alter table if exists "bundle" add constraint "bundle_discount_percentage_check" check ("discount_percentage" is null or "discount_percentage" between 0 and 100);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "bundle" drop constraint if exists "bundle_discount_percentage_check";`);
    this.addSql(`alter table if exists "bundle" drop column if exists "pricing_mode", drop column if exists "discount_percentage";`);

    this.addSql(`alter table if exists "bundle_item" drop column if exists "display_order", drop column if exists "variant_mode";`);
  }

}
