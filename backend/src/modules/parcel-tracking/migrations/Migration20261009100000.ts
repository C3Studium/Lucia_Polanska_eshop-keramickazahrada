import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Modul „Sledování zásilek ČP" (docs/sledovani-zasilek.md §2): tabulka
 * `parcel_tracking`, jedna zásilka na objednávku.
 *
 * Psaná ručně ve stylu ostatních modulů (ne `db:generate`): CHECK na `phase`
 * drží tytéž hodnoty jako `PARCEL_PHASES`, unikát na `order_id` je částečný
 * index přes `deleted_at IS NULL` — stejně jako u `merchant_order_state`, ať
 * se smazaný řádek nepere s novým. Index na `done` je pro job, který každou
 * půlhodinu bere jen neuzavřené řádky.
 */
export class Migration20261009100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "parcel_tracking" ("id" text not null, "order_id" text not null, "carrier" text not null default 'ceska-posta', "parcel_code" text not null, "service_code" text null, "phase" text check ("phase" in ('label', 'handed_over', 'in_transit', 'stored', 'delivered', 'returned', 'problem')) not null default 'label', "events" jsonb not null default '[]', "handed_over_at" timestamptz null, "stored_at" timestamptz null, "delivered_at" timestamptz null, "returned_at" timestamptz null, "last_state_id" text null, "last_state_text" text null, "last_checked_at" timestamptz null, "check_count" integer not null default 0, "done" boolean not null default false, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "parcel_tracking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_parcel_tracking_deleted_at" ON "parcel_tracking" (deleted_at) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_parcel_tracking_order_id_unique" ON "parcel_tracking" (order_id) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_parcel_tracking_done" ON "parcel_tracking" (done) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "parcel_tracking" cascade;`);
  }

}
