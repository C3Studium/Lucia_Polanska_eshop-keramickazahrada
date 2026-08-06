import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * The zakázka diary (production_note) — photos and notes on the making.
 *
 * `if not exists` because deploys re-run migrations against databases that
 * may have been patched by hand. Class name unique across all modules —
 * enforced by migration-names.unit.spec.ts after the newsletter collision.
 */
export class Migration20260806150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "production_note" (
        "id" text not null,
        "order_id" text not null,
        "text" text null,
        "image_url" text null,
        "visible_to_customer" boolean not null default false,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "production_note_pkey" primary key ("id")
      );`
    );
    this.addSql(
      `create index if not exists "IDX_production_note_order_id" on "production_note" ("order_id") where "deleted_at" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "production_note" cascade;`);
  }
}
