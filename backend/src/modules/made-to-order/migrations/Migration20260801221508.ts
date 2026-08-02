import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221508 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "variant_production_profile" drop constraint if exists "variant_production_profile_variant_id_unique";`);
    this.addSql(`alter table if exists "product_production_profile" drop constraint if exists "product_production_profile_product_id_unique";`);
    this.addSql(`alter table if exists "production_payment_request" drop constraint if exists "production_payment_request_idempotency_key_unique";`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_order_id_unique";`);
    this.addSql(`create table if not exists "production_order" ("id" text not null, "order_id" text not null, "stage" text check ("stage" in ('specification_pending', 'confirmed', 'in_production', 'awaiting_balance', 'ready_to_ship', 'completed', 'cancelled')) not null default 'specification_pending', "deposit_percentage" integer not null, "agreed_total" numeric null, "currency_code" text not null, "estimated_completion_at" timestamptz null, "specification_confirmed_at" timestamptz null, "production_started_at" timestamptz null, "production_completed_at" timestamptz null, "balance_requested_at" timestamptz null, "customer_note" text null, "internal_note" text null, "raw_agreed_total" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "production_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_order_order_id_unique" ON "production_order" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_order_deleted_at" ON "production_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "production_payment_request" ("id" text not null, "type" text check ("type" in ('deposit', 'balance')) not null, "status" text check ("status" in ('draft', 'pending', 'sent', 'paid', 'failed', 'expired', 'cancelled')) not null default 'draft', "amount" numeric not null, "currency_code" text not null, "payment_collection_id" text null, "payment_session_id" text null, "idempotency_key" text not null, "sent_at" timestamptz null, "paid_at" timestamptz null, "expires_at" timestamptz null, "production_order_id" text not null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "production_payment_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_payment_request_idempotency_key_unique" ON "production_payment_request" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_production_order_id" ON "production_payment_request" ("production_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_deleted_at" ON "production_payment_request" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_production_profile" ("id" text not null, "product_id" text not null, "enabled" boolean not null default true, "specification_required" boolean not null default true, "specification_prompt" text null, "production_time_min_days" integer not null default 14, "production_time_max_days" integer not null default 42, "default_deposit_percentage" integer not null default 25, "contact_customer_after_order" boolean not null default true, "allow_final_price_adjustment" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_production_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_production_profile_product_id_unique" ON "product_production_profile" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_production_profile_deleted_at" ON "product_production_profile" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "variant_production_profile" ("id" text not null, "variant_id" text not null, "deposit_percentage_override" integer null, "production_time_min_days_override" integer null, "production_time_max_days_override" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "variant_production_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_production_profile_variant_id_unique" ON "variant_production_profile" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_variant_production_profile_deleted_at" ON "variant_production_profile" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "product_production_profile" add constraint "product_production_profile_deposit_check" check ("default_deposit_percentage" between 0 and 100);`);
    this.addSql(`alter table if exists "product_production_profile" add constraint "product_production_profile_days_check" check ("production_time_min_days" >= 0 and "production_time_max_days" >= "production_time_min_days");`);
    this.addSql(`alter table if exists "variant_production_profile" add constraint "variant_production_profile_deposit_check" check ("deposit_percentage_override" is null or "deposit_percentage_override" between 0 and 100);`);
    this.addSql(`alter table if exists "variant_production_profile" add constraint "variant_production_profile_days_check" check ("production_time_min_days_override" is null or "production_time_max_days_override" is null or ("production_time_min_days_override" >= 0 and "production_time_max_days_override" >= "production_time_min_days_override"));`);
    this.addSql(`alter table if exists "production_order" add constraint "production_order_deposit_check" check ("deposit_percentage" between 0 and 100);`);
    this.addSql(`alter table if exists "production_payment_request" add constraint "production_payment_request_amount_check" check ("amount" > 0);`);
    this.addSql(`alter table if exists "production_payment_request" add constraint "production_payment_request_production_order_id_foreign" foreign key ("production_order_id") references "production_order" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_payment_request" drop constraint if exists "production_payment_request_production_order_id_foreign";`);
    this.addSql(`alter table if exists "production_payment_request" drop constraint if exists "production_payment_request_amount_check";`);
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_deposit_check";`);
    this.addSql(`alter table if exists "variant_production_profile" drop constraint if exists "variant_production_profile_days_check";`);
    this.addSql(`alter table if exists "variant_production_profile" drop constraint if exists "variant_production_profile_deposit_check";`);
    this.addSql(`alter table if exists "product_production_profile" drop constraint if exists "product_production_profile_days_check";`);
    this.addSql(`alter table if exists "product_production_profile" drop constraint if exists "product_production_profile_deposit_check";`);

    this.addSql(`drop table if exists "production_order" cascade;`);

    this.addSql(`drop table if exists "production_payment_request" cascade;`);

    this.addSql(`drop table if exists "product_production_profile" cascade;`);

    this.addSql(`drop table if exists "variant_production_profile" cascade;`);
  }

}
