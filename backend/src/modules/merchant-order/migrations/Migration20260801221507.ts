import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801221507 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "merchant_order_state" drop constraint if exists "merchant_order_state_order_id_unique";`);
    this.addSql(`create table if not exists "merchant_order_state" ("id" text not null, "order_id" text not null, "stage" text check ("stage" in ('received', 'working', 'shipping', 'shipped', 'payment_problem', 'cancelled')) not null default 'received', "requires_attention" boolean not null default false, "attention_reason" text null, "stage_changed_at" timestamptz null, "stage_changed_by" text null, "internal_note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_order_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_order_state_order_id_unique" ON "merchant_order_state" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_merchant_order_state_deleted_at" ON "merchant_order_state" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "merchant_order_state" cascade;`);
  }

}
