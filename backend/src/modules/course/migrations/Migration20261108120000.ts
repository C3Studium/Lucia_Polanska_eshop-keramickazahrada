import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Vypínač množstevní slevy a dětská cena u termínu kurzu (8. 11. 2026).
 *
 * volume_pricing_enabled má výchozí true, aby se starým termínům cena
 * nezměnila pod rukama — kdo slevu za dva a za skupinu vyplněnou má, nabízí
 * ji dál, dokud ji sám nevypne. Psáno ručně a idempotentně.
 */
export class Migration20261108120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_term" add column if not exists "volume_pricing_enabled" boolean not null default true;`);
    this.addSql(`alter table if exists "course_term" add column if not exists "price_child" numeric null;`);
    this.addSql(`alter table if exists "course_term" add column if not exists "child_max_age" integer null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_term" drop column if exists "child_max_age";`);
    this.addSql(`alter table if exists "course_term" drop column if exists "price_child";`);
    this.addSql(`alter table if exists "course_term" drop column if exists "volume_pricing_enabled";`);
  }
}
