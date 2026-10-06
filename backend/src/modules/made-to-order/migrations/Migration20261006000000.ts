import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006000000 extends Migration {

  override async up(): Promise<void> {
    // batch_id — jedno odeslání (víc fotek + text) = jedna zpráva ve vlákně.
    this.addSql(`alter table if exists "production_note" add column if not exists "batch_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_note" drop column if exists "batch_id";`);
  }

}
