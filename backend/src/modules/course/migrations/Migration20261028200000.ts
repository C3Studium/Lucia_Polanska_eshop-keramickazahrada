import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Faktura na doplatek po přidání osob (iDoklad fakturu změnit neumí — doplatek
 * dostane vlastní doklad). Psáno ručně a idempotentně.
 */
export class Migration20261028200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_payment_request" add column if not exists "idoklad_invoice_id" integer null;`);
    this.addSql(`alter table if exists "course_payment_request" add column if not exists "idoklad_invoice_number" text null;`);
    this.addSql(`alter table if exists "course_payment_request" add column if not exists "idoklad_pdf_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_payment_request" drop column if exists "idoklad_pdf_url";`);
    this.addSql(`alter table if exists "course_payment_request" drop column if exists "idoklad_invoice_number";`);
    this.addSql(`alter table if exists "course_payment_request" drop column if exists "idoklad_invoice_id";`);
  }
}
