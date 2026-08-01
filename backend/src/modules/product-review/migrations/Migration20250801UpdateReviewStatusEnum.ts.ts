import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20250801UpdateReviewStatusEnum extends Migration {
  override async up(): Promise<void> {
    // 1. Drop the old constraint
    this.addSql(`
      ALTER TABLE "review" DROP CONSTRAINT IF EXISTS "review_status_check";
    `);

    // 2. Update the data
    this.addSql(`
      UPDATE "review" SET "status" = 'čeká na schválení' WHERE "status" = 'pending';
      UPDATE "review" SET "status" = 'schváleno' WHERE "status" = 'approved';
      UPDATE "review" SET "status" = 'zamítnuto' WHERE "status" = 'rejected';
    `);

    // 3. Add the new constraint
    this.addSql(`
      ALTER TABLE "review"
      ADD CONSTRAINT "review_status_check"
      CHECK ("status" IN ('čeká na schválení', 'schváleno', 'zamítnuto'));
    `);
  }

  override async down(): Promise<void> {
    // 1. Drop the new constraint
    this.addSql(`
      ALTER TABLE "review" DROP CONSTRAINT IF EXISTS "review_status_check";
    `);

    // 2. Revert the data
    this.addSql(`
      UPDATE "review" SET "status" = 'pending' WHERE "status" = 'čeká na schválení';
      UPDATE "review" SET "status" = 'approved' WHERE "status" = 'schváleno';
      UPDATE "review" SET "status" = 'rejected' WHERE "status" = 'zamítnuto';
    `);

    // 3. Add the old constraint back
    this.addSql(`
      ALTER TABLE "review"
      ADD CONSTRAINT "review_status_check"
      CHECK ("status" IN ('pending', 'approved', 'rejected'));
    `);
  }
}
