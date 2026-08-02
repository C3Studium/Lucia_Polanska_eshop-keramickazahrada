import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221725 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_publication_status" ON "seasonal_selection" ("publication_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_starts_at" ON "seasonal_selection" ("starts_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_ends_at" ON "seasonal_selection" ("ends_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seasonal_selection_linked_price_list_id" ON "seasonal_selection" ("linked_price_list_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_seasonal_selection_publication_status";`);
    this.addSql(`drop index if exists "IDX_seasonal_selection_starts_at";`);
    this.addSql(`drop index if exists "IDX_seasonal_selection_ends_at";`);
    this.addSql(`drop index if exists "IDX_seasonal_selection_linked_price_list_id";`);
  }

}
