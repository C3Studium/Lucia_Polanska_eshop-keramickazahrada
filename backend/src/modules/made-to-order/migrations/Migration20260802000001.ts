import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260802000001 extends Migration {

  override async up(): Promise<void> {
    // ─── production_order: add missing columns ───────────────────────────────

    // original_total (bigNumber → numeric + raw_original_total jsonb)
    this.addSql(`alter table if exists "production_order" add column if not exists "original_total" numeric not null default 0;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_original_total" jsonb not null default '{}';`);

    // final_total_confirmed_at
    this.addSql(`alter table if exists "production_order" add column if not exists "final_total_confirmed_at" timestamptz null;`);

    // production_completed_at
    this.addSql(`alter table if exists "production_order" add column if not exists "production_completed_at" timestamptz null;`);

    // ready_to_ship_at
    this.addSql(`alter table if exists "production_order" add column if not exists "ready_to_ship_at" timestamptz null;`);

    // completed_at
    this.addSql(`alter table if exists "production_order" add column if not exists "completed_at" timestamptz null;`);

    // ─── production_payment_request: add missing columns ─────────────────────

    // provider_transaction_id (unique, nullable)
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "provider_transaction_id" text null;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_payment_request_provider_transaction_id_unique" ON "production_payment_request" ("provider_transaction_id") WHERE deleted_at IS NULL AND provider_transaction_id IS NOT NULL;`);

    // payment_url
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "payment_url" text null;`);

    // selected_method
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "selected_method" text null;`);

    // provider_status (indexed, nullable)
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "provider_status" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_provider_status" ON "production_payment_request" ("provider_status") WHERE deleted_at IS NULL;`);

    // provider_error_reason
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "provider_error_reason" text null;`);

    // create_state (enum with default)
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "create_state" text check ("create_state" in ('not_started', 'creating', 'created', 'unknown', 'failed')) not null default 'not_started';`);

    // notification_sent_at
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "notification_sent_at" timestamptz null;`);

    // last_checked_at
    this.addSql(`alter table if exists "production_payment_request" add column if not exists "last_checked_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    // production_order
    this.addSql(`alter table if exists "production_order" drop column if exists "original_total";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "raw_original_total";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "final_total_confirmed_at";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "production_completed_at";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "ready_to_ship_at";`);
    this.addSql(`alter table if exists "production_order" drop column if exists "completed_at";`);

    // production_payment_request
    this.addSql(`drop index if exists "IDX_production_payment_request_provider_transaction_id_unique";`);
    this.addSql(`drop index if exists "IDX_production_payment_request_provider_status";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "provider_transaction_id";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "payment_url";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "selected_method";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "provider_status";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "provider_error_reason";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "create_state";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "notification_sent_at";`);
    this.addSql(`alter table if exists "production_payment_request" drop column if exists "last_checked_at";`);
  }

}
