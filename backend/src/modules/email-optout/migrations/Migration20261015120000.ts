import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Odmítnutí e-mailů z oprávněného zájmu jedním kliknutím (§ 7 odst. 3
 * zákona č. 480/2004 Sb., čl. 21 GDPR): `email_opt_out` — adresa
 * (normalizovaná) a druh e-mailu, unikátní dvojice.
 *
 * Psáno ručně (generátor nedosáhne na databázi na Railway) a idempotentně
 * (`if not exists`), jako ostatní migrace v repu.
 */
export class Migration20261015120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "email_opt_out" ("id" text not null, "email" text not null, "kind" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_opt_out_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_opt_out_deleted_at" ON "email_opt_out" (deleted_at) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_opt_out_email_kind_unique" ON "email_opt_out" (email, kind) WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_opt_out_email" ON "email_opt_out" (email) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_opt_out" cascade;`);
  }

}
