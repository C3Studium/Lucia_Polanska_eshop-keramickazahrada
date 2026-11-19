import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Návod — klíč → GIF (`navod_klip`). Psáno ručně a idempotentně jako
 * ostatní migrace v repu.
 */
export class Migration20261119120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "navod_klip" ("id" text not null, "key" text not null, "area" text not null, "url" text not null, "file_id" text null, "width" integer null, "height" integer null, "bytes" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "navod_klip_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_navod_klip_deleted_at" ON "navod_klip" (deleted_at) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_navod_klip_key_unique" ON "navod_klip" (key) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_navod_klip_area" ON "navod_klip" (area) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "navod_klip" cascade;`);
  }

}
