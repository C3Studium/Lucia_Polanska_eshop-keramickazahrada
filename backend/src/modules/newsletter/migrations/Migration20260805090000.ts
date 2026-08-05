import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Written by hand rather than generated: `medusa db:generate` diffs against a
 * live database, and the production one is only reachable from inside Railway.
 * Statements are idempotent (`if not exists`), so re-running on boot is safe.
 */
export class Migration20260805090000 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table if not exists "newsletter_subscriber" ("id" text not null, "email" text not null, "source" text null, "subscribed_at" timestamptz not null, "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscriber_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" (deleted_at) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email_unique" ON "newsletter_subscriber" (email) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "newsletter_subscriber" cascade;');
  }

}
