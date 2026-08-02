import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221727 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_order_stage" ON "production_order" ("stage") WHERE deleted_at IS NULL;`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_status" ON "production_payment_request" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_payment_collection_id" ON "production_payment_request" ("payment_collection_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_production_payment_request_payment_session_id" ON "production_payment_request" ("payment_session_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_production_order_stage";`);

    this.addSql(`drop index if exists "IDX_production_payment_request_status";`);
    this.addSql(`drop index if exists "IDX_production_payment_request_payment_collection_id";`);
    this.addSql(`drop index if exists "IDX_production_payment_request_payment_session_id";`);
  }

}
