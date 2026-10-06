import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006190000 extends Migration {

  override async up(): Promise<void> {
    // Reklamační protokol (PDF) — fáze 2 modulu reklamací.
    this.addSql(`alter table if exists "return_request" add column if not exists "protocol_url" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "protocol_number" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request" drop column if exists "protocol_url";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "protocol_number";`);
  }

}
