import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Žádosti o místo na plně obsazeném termínu (rozšíření čekací listiny).
 *
 * `course_waitlist` dostává telefon, vzkaz, stav (`waiting` / `approved` /
 * `denied`), rozhodnutí majitelky a odkaz na rezervaci, která schválením
 * vznikne. `course_reservation.payment_choice_pending` = schválená výjimka,
 * kde si zákazník ještě vybírá platbu. Stávající záznamy zůstávají `waiting`.
 *
 * Psáno ručně a idempotentně, jako ostatní migrace modulu.
 */
export class Migration20261028180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "phone" text null;`);
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "note" text null;`);
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "status" text check ("status" in ('waiting', 'approved', 'denied')) not null default 'waiting';`);
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "decided_at" timestamptz null;`);
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "decision_note" text null;`);
    this.addSql(`alter table if exists "course_waitlist" add column if not exists "reservation_id" text null;`);
    this.addSql(`create index if not exists "IDX_course_waitlist_status" on "course_waitlist" ("status") where "deleted_at" is null;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "payment_choice_pending" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" drop column if exists "payment_choice_pending";`);
    this.addSql(`drop index if exists "IDX_course_waitlist_status";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "reservation_id";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "decision_note";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "decided_at";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "status";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "note";`);
    this.addSql(`alter table if exists "course_waitlist" drop column if exists "phone";`);
  }

}
