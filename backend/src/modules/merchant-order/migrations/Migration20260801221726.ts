import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221726 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merchant_order_state_stage" ON "merchant_order_state" ("stage") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_merchant_order_state_stage";`);
  }

}
