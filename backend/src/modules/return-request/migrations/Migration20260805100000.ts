import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260805100000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "return_request" ("id" text not null, "order_id" text not null, "order_display_id" text not null, "email" text not null, "customer_name" text null, "reason" text not null, "items" jsonb null, "status" text check ("status" in (\'pending\', \'approved\', \'rejected\')) not null default \'pending\', "decision_note" text null, "decided_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_return_request_deleted_at" ON "return_request" (deleted_at) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_return_request_status" ON "return_request" (status) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_return_request_order_id" ON "return_request" (order_id) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "return_request" cascade;');
  }

}
