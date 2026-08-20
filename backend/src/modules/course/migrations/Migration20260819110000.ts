import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Course completion features (docs/kurzy-system.md):
 *
 * - `course_reservation.cancel_reason` — why a reservation was cancelled
 *   ('auto_expired' by the 24h expiry job, 'manual' by the owner,
 *   'term_cancelled' with the whole term), so the admin list can say it in
 *   words instead of leaving every cancel looking the same.
 * - `course_reservation.refunded_at` — stamped once the automatic ComGate
 *   refund succeeded; the never-refund-twice guard.
 * - `course_waitlist` — people waiting for a full term to free up; notified
 *   FIFO when seats open, `notified_at` keeps each entry to one e-mail.
 *
 * Everything is written idempotently (IF NOT EXISTS / drop-then-add), matching
 * the house rule for hand-written module migrations.
 */
export class Migration20260819110000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_reason" text null;`);
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_cancel_reason_check";`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_cancel_reason_check" check ("cancel_reason" is null or "cancel_reason" in ('auto_expired', 'manual', 'term_cancelled'));`);

    this.addSql(`alter table if exists "course_reservation" add column if not exists "refunded_at" timestamptz null;`);

    this.addSql(`create table if not exists "course_waitlist" ("id" text not null, "term_id" text not null, "name" text not null, "email" text not null, "party_size" integer not null, "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "course_waitlist_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_waitlist_term_id" ON "course_waitlist" ("term_id") WHERE deleted_at IS NULL;`);
    // The FIFO scan: entries of one term in arrival order.
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_waitlist_term_id_created_at" ON "course_waitlist" ("term_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_course_waitlist_deleted_at" ON "course_waitlist" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "course_waitlist" drop constraint if exists "course_waitlist_party_size_check";`);
    this.addSql(`alter table if exists "course_waitlist" add constraint "course_waitlist_party_size_check" check ("party_size" >= 1);`);
    this.addSql(`alter table if exists "course_waitlist" drop constraint if exists "course_waitlist_term_id_foreign";`);
    this.addSql(`alter table if exists "course_waitlist" add constraint "course_waitlist_term_id_foreign" foreign key ("term_id") references "course_term" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_waitlist" drop constraint if exists "course_waitlist_term_id_foreign";`);
    this.addSql(`alter table if exists "course_waitlist" drop constraint if exists "course_waitlist_party_size_check";`);
    this.addSql(`drop table if exists "course_waitlist" cascade;`);

    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_cancel_reason_check";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_reason";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "refunded_at";`);
  }

}
