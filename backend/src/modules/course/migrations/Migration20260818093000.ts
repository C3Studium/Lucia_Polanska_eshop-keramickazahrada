import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260818093000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "course_term" ("id" text not null, "title" text not null, "location" text not null, "starts_at" timestamptz not null, "duration_minutes" integer null, "capacity" integer not null, "price_single" numeric not null, "price_two" numeric null, "group_min" integer null, "price_group_per_person" numeric null, "status" text check ("status" in ('draft', 'published', 'cancelled', 'finished')) not null default 'draft', "note" text null, "raw_price_single" jsonb not null, "raw_price_two" jsonb null, "raw_price_group_per_person" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "course_term_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_term_starts_at" ON "course_term" ("starts_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_term_status" ON "course_term" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_term_deleted_at" ON "course_term" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "course_reservation" ("id" text not null, "term_id" text not null, "customer_id" text null, "name" text not null, "email" text null, "phone" text null, "party_size" integer not null, "pricing_tier" text check ("pricing_tier" in ('single', 'pair', 'group')) not null, "total_price" numeric not null, "payment_method" text check ("payment_method" in ('online', 'on_site')) not null, "payment_status" text check ("payment_status" in ('pending', 'paid', 'on_site')) not null default 'pending', "paid_at" timestamptz null, "status" text check ("status" in ('active', 'cancelled')) not null default 'active', "cancelled_at" timestamptz null, "source" text check ("source" in ('web', 'manual')) not null default 'web', "note" text null, "payment_collection_id" text null, "payment_session_id" text null, "provider_transaction_id" text null, "payment_url" text null, "idoklad_invoice_id" integer null, "idoklad_invoice_number" text null, "idoklad_pdf_url" text null, "raw_total_price" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "course_reservation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_term_id" ON "course_reservation" ("term_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_customer_id" ON "course_reservation" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_payment_status" ON "course_reservation" ("payment_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_status" ON "course_reservation" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_payment_collection_id" ON "course_reservation" ("payment_collection_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_payment_session_id" ON "course_reservation" ("payment_session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_reservation_deleted_at" ON "course_reservation" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "course_term" add constraint "course_term_capacity_check" check ("capacity" >= 1);`);
    this.addSql(`alter table if exists "course_term" add constraint "course_term_price_single_check" check ("price_single" >= 0);`);
    this.addSql(`alter table if exists "course_term" add constraint "course_term_group_min_check" check ("group_min" is null or "group_min" >= 2);`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_party_size_check" check ("party_size" >= 1);`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_total_price_check" check ("total_price" >= 0);`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_term_id_foreign" foreign key ("term_id") references "course_term" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_term_id_foreign";`);
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_total_price_check";`);
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_party_size_check";`);
    this.addSql(`alter table if exists "course_term" drop constraint if exists "course_term_group_min_check";`);
    this.addSql(`alter table if exists "course_term" drop constraint if exists "course_term_price_single_check";`);
    this.addSql(`alter table if exists "course_term" drop constraint if exists "course_term_capacity_check";`);

    this.addSql(`drop table if exists "course_reservation" cascade;`);

    this.addSql(`drop table if exists "course_term" cascade;`);
  }

}
