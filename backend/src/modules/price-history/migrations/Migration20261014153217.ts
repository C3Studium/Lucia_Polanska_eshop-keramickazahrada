import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Historie cen pro § 12a (nejnižší cena za 30 dní před slevou).
 *
 * Psáno ručně, ne `medusa db:generate` — generátor potřebuje spojení
 * s databází a ta je na Railway za interní adresou. Tvar odpovídá tomu, co
 * generátor dělá u ostatních modulů: `bigNumber` = `numeric` + `raw_*` jsonb,
 * enum = text s check constraintem, indexy jen nad nesmazanými řádky.
 *
 * Název třídy má „lichou" vteřinu záměrně: MikroORM eviduje migrace podle
 * názvu třídy napříč moduly (viz `modules/__tests__/migration-names`).
 */
export class Migration20261014153217 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "price_history_entry" ("id" text not null, "variant_id" text not null, "currency_code" text not null, "kind" text check ("kind" in ('base', 'sale')) not null, "amount" numeric not null, "price_list_id" text null, "recorded_on" text not null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "price_history_entry_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_history_entry_unique_day" ON "price_history_entry" (variant_id, currency_code, kind, recorded_on) WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_history_entry_recorded_on" ON "price_history_entry" (recorded_on) WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_price_history_entry_deleted_at" ON "price_history_entry" (deleted_at) WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "price_history_entry" cascade;`)
  }

}
