import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Stage history on the merchant order state.
 *
 * One jsonb column, not a history table: the shop sees tens of orders a
 * week and each has a handful of transitions, so a relational log would be
 * modelling for a scale this data will never have. Appended by
 * `transition-merchant-order`; never rewritten.
 *
 * `if not exists` because migrations here run on deploy against a database
 * that may already have been patched by hand once.
 */
export class Migration20260806120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "merchant_order_state" ADD COLUMN IF NOT EXISTS "stage_history" jsonb NOT NULL DEFAULT '[]';`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "merchant_order_state" DROP COLUMN IF EXISTS "stage_history";`
    );
  }
}
