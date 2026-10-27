import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Úprava počtu osob u zaplacené rezervace — evidence peněz (vzor zakázky).
 *
 * - `course_reservation.paid_amount` = kolik zákazník u nás má zaplaceno,
 *   `amount_due` = kolik zbývá (doplatek po přidání osob, nebo platba na místě).
 * - `course_payment_request` = každý doplatek / vratka po prvotní platbě
 *   s vlastní ComGate platbou a stavem.
 *
 * Doplnění stávajících řádků:
 * - zaplaceno online a nevráceno → zaplaceno = cena, zbývá 0,
 * - zaplaceno a vráceno (zrušená s vrácením) → zaplaceno 0, zbývá 0,
 * - čeká na online platbu / platí na místě → zaplaceno 0, zbývá = cena
 *   (u zrušených 0).
 *
 * Psáno ručně a idempotentně, jako ostatní migrace modulu.
 */
export class Migration20261028120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" add column if not exists "paid_amount" numeric not null default 0;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "raw_paid_amount" jsonb not null default '{"value":"0","precision":20}';`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "amount_due" numeric not null default 0;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "raw_amount_due" jsonb not null default '{"value":"0","precision":20}';`);

    this.addSql(`
      update "course_reservation" set
        "paid_amount" = case
          when "payment_status" = 'paid' and "refunded_at" is null then "total_price"
          else 0 end,
        "amount_due" = case
          when "status" = 'cancelled' then 0
          when "payment_status" = 'paid' then 0
          else "total_price" end
      where "deleted_at" is null;`);
    this.addSql(`update "course_reservation" set
        "raw_paid_amount" = jsonb_build_object('value', "paid_amount"::text, 'precision', 20),
        "raw_amount_due" = jsonb_build_object('value', "amount_due"::text, 'precision', 20);`);

    this.addSql(`create table if not exists "course_payment_request" (
      "id" text not null,
      "reservation_id" text not null,
      "type" text check ("type" in ('supplement', 'refund')) not null,
      "status" text check ("status" in ('pending', 'paid', 'cancelled', 'refunded', 'failed')) not null default 'pending',
      "amount" numeric not null,
      "raw_amount" jsonb not null,
      "party_size" integer not null,
      "total_price" numeric not null,
      "raw_total_price" jsonb not null,
      "payment_collection_id" text null,
      "payment_session_id" text null,
      "payment_url" text null,
      "paid_at" timestamptz null,
      "note" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "course_payment_request_pkey" primary key ("id"));`);
    this.addSql(`create index if not exists "IDX_course_payment_request_reservation_id" on "course_payment_request" ("reservation_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_course_payment_request_status" on "course_payment_request" ("status") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_course_payment_request_payment_collection_id" on "course_payment_request" ("payment_collection_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_course_payment_request_payment_session_id" on "course_payment_request" ("payment_session_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_course_payment_request_deleted_at" on "course_payment_request" ("deleted_at") where "deleted_at" is null;`);
    this.addSql(`do $$ begin
      if not exists (select 1 from pg_constraint where conname = 'course_payment_request_reservation_id_foreign') then
        alter table "course_payment_request" add constraint "course_payment_request_reservation_id_foreign"
          foreign key ("reservation_id") references "course_reservation" ("id") on update cascade;
      end if;
    end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "course_payment_request" cascade;`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "raw_amount_due";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "amount_due";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "raw_paid_amount";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "paid_amount";`);
  }

}
