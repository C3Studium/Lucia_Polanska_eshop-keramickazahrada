import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Written by hand rather than generated: `medusa db:generate` diffs against a
 * live database, and the production one is only reachable from inside Railway.
 * Statements are idempotent (`if not exists`), so re-running on boot is safe.
 */
/**
 * Renamed from Migration20260805090000 (2026-08-06). Two modules shipped
 * migrations with that exact class name — this one and product-review's —
 * and MikroORM records executed migrations *by class name* in one shared
 * table. Whichever ran second was silently skipped: no error, no table. The
 * integration suite caught it as `relation "newsletter_subscriber" does not
 * exist` on a freshly migrated database, which means production skipped it
 * too. The rename makes it run; `create table if not exists` makes the rerun
 * harmless anywhere it did win the race. The name-collision guard lives in
 * migration-names.unit.spec.ts so a third collision cannot ship.
 */
export class Migration20260805090001 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "newsletter_subscriber" ("id" text not null, "email" text not null, "source" text null, "subscribed_at" timestamptz not null, "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscriber_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" (deleted_at) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email_unique" ON "newsletter_subscriber" (email) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "newsletter_subscriber" cascade;');
  }

}
