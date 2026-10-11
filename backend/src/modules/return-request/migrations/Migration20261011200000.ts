import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Účet pro vrácení převodem (lib/claims/refund-account.ts) — dobírka a
 * osobní odběr se nedají vrátit na kartu, majitelka potřebuje číslo účtu.
 */
export class Migration20261011200000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "return_request" add column if not exists "refund_account" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request" drop column if exists "refund_account";`);
  }

}
