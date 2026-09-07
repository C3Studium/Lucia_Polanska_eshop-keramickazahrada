import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Psáno ručně, ne `medusa db:generate`.
 *
 * Generátor potřebuje spojení s databází a ta je na Railway za interní adresou,
 * na kterou se z vývojářského stroje nedá dosáhnout. Tvar odpovídá tomu, co
 * generátor dělá u ostatních modulů: `deleted_at` index pro měkké mazání,
 * unikátní index na `key` jen nad nesmazanými řádky.
 */
export class Migration20260907090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "site_document" ("id" text not null, "key" text not null, "title" text not null, "file_url" text not null, "file_name" text null, "mime_type" text null, "size" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_document_key_unique" ON "site_document" (key) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_document_deleted_at" ON "site_document" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_document" cascade;`);
  }

}
