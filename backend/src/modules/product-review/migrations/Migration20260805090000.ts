import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds „archivováno" to the review status enum.
 *
 * The moderation view has four tabs and the model had three states. Archiving
 * is a decision she makes — „I have dealt with this, stop showing it to me" —
 * so it is a real state rather than something derived from age, which would be
 * a tab she cannot control.
 *
 * The status column is a plain text column with a check constraint (see
 * `Migration20250801UpdateReviewStatusEnum`), so widening it is a constraint
 * swap. No data changes: every existing review keeps the status it has.
 */
export class Migration20260805090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "review" DROP CONSTRAINT IF EXISTS "review_status_check";`
    );
    this.addSql(
      `ALTER TABLE "review" ADD CONSTRAINT "review_status_check" ` +
        `CHECK ("status" IN ('čeká na schválení', 'schváleno', 'zamítnuto', 'archivováno'));`
    );
  }

  override async down(): Promise<void> {
    // Anything archived goes back to rejected — the closest state that exists
    // without this migration, and the one that keeps it out of her queue.
    this.addSql(
      `UPDATE "review" SET "status" = 'zamítnuto' WHERE "status" = 'archivováno';`
    );
    this.addSql(
      `ALTER TABLE "review" DROP CONSTRAINT IF EXISTS "review_status_check";`
    );
    this.addSql(
      `ALTER TABLE "review" ADD CONSTRAINT "review_status_check" ` +
        `CHECK ("status" IN ('čeká na schválení', 'schváleno', 'zamítnuto'));`
    );
  }

}
