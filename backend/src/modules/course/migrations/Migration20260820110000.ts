import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Customer self-service cancellation (docs/kurzy-system.md):
 *
 * `course_reservation.cancel_reason` grows a fourth value — 'customer' — for
 * reservations the customer cancels themselves from the reservation page or
 * their account. The admin list can then say „zrušil zákazník" instead of
 * filing it under the owner's own cancels.
 *
 * Drop-then-add, matching the house pattern for check constraints; both
 * statements are idempotent so a re-run is harmless.
 */
export class Migration20260820110000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_cancel_reason_check";`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_cancel_reason_check" check ("cancel_reason" is null or "cancel_reason" in ('auto_expired', 'manual', 'term_cancelled', 'customer'));`);
  }

  override async down(): Promise<void> {
    // Rows cancelled by customers keep their history; the narrower constraint
    // can only come back once no 'customer' rows exist, so the down migration
    // neutralises them to 'manual' first.
    this.addSql(`update "course_reservation" set "cancel_reason" = 'manual' where "cancel_reason" = 'customer';`);
    this.addSql(`alter table if exists "course_reservation" drop constraint if exists "course_reservation_cancel_reason_check";`);
    this.addSql(`alter table if exists "course_reservation" add constraint "course_reservation_cancel_reason_check" check ("cancel_reason" is null or "cancel_reason" in ('auto_expired', 'manual', 'term_cancelled'));`);
  }

}
