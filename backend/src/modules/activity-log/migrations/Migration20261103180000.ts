import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Provozní deník (3. 11. 2026) — jeden řádek za každou věc, která se
 * v obchodě stane. Proč, je v `models/activity-event.ts`.
 *
 * Psáno ručně a idempotentně, jako ostatní migrace v repu (generátor
 * nedosáhne na databázi na Railway).
 *
 * Indexy jsou tři a každý má svůj dotaz:
 * - `created_at` — denní souhrn a stránka Provoz čtou vždy časové okno,
 * - `status` částečně jen pro chyby — hlídka se ptá na ně a je jich zlomek,
 * - `kind, created_at` — souhrn počítá po druzích za den.
 */
export class Migration20261103180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "activity_event" ("id" text not null, "kind" text not null, "action" text not null, "status" text not null, "actor" text null, "ref_type" text null, "ref_id" text null, "summary" text null, "detail" jsonb null, "duration_ms" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "activity_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_activity_event_created_at" ON "activity_event" ("created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_activity_event_chyby" ON "activity_event" ("created_at") WHERE deleted_at IS NULL AND status = 'chyba';`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_activity_event_kind_created_at" ON "activity_event" ("kind", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_activity_event_ref" ON "activity_event" ("ref_type", "ref_id") WHERE deleted_at IS NULL AND ref_id IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_activity_event_deleted_at" ON "activity_event" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "activity_event" cascade;`);
  }

}
