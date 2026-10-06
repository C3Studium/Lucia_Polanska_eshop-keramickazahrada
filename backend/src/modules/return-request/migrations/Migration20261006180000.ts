import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006180000 extends Migration {

  override async up(): Promise<void> {
    // Fotky vady / zboží k žádosti o reklamaci/vrácení — pole URL v úložišti.
    this.addSql(`alter table if exists "return_request" add column if not exists "photos" jsonb null;`);
    // Fáze 1 modulu reklamací: typovaný druh, zákonná lhůta, záznam vrácení peněz.
    this.addSql(`alter table if exists "return_request" add column if not exists "kind" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "resolve_by" timestamptz null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "refund_amount" numeric null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "refund_method" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "refunded_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request" drop column if exists "photos";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "kind";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "resolve_by";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "refund_amount";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "refund_method";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "refunded_at";`);
  }

}
