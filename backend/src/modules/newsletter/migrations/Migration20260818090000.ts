import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Double opt-in + campaign history (newsletter admin, 2026-08).
 *
 * Written by hand rather than generated, like Migration20260805090001: the
 * production database is only reachable from inside Railway, so there is
 * nothing to diff against. Statements are idempotent (`if not exists`), so
 * re-running on boot is safe. The class name is unique across all modules —
 * `src/modules/__tests__/migration-names.unit.spec.ts` enforces it.
 *
 * ## The backfill, and why it is honest
 *
 * `confirmed_at` arrives with double opt-in. Rows that already exist were
 * collected by the footer form under single opt-in — the form carried the
 * consent sentence („váš e-mail použijeme jen pro zasílání novinek") and the
 * welcome e-mail carried an unsubscribe link, so their consent evidence is
 * the signup itself. Backfilling `confirmed_at = subscribed_at` for the
 * *active* rows records exactly that: consent given at signup time. Leaving
 * them `null` would silently drop the whole existing list from every future
 * campaign, which no one asked for. Unsubscribed rows stay unconfirmed —
 * they are excluded either way, and inventing confirmation for someone who
 * left would be fiction. New signups after this migration start at `null`
 * and must click the confirm link.
 */
export class Migration20260818090000 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table if exists "newsletter_subscriber" add column if not exists "confirmed_at" timestamptz null;');
    // Backfill runs once and only touches rows that predate the column; the
    // `confirmed_at is null` guard makes a re-run a no-op.
    this.addSql('update "newsletter_subscriber" set "confirmed_at" = "subscribed_at" where "confirmed_at" is null and "unsubscribed_at" is null;');

    this.addSql('create table if not exists "newsletter_campaign" ("id" text not null, "subject" text not null, "preheader" text null, "blocks" jsonb null, "campaign_key" text not null, "recipients" integer not null default 0, "sent_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_campaign_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_campaign_deleted_at" ON "newsletter_campaign" (deleted_at) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_campaign_campaign_key_unique" ON "newsletter_campaign" (campaign_key) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "newsletter_subscriber" drop column if exists "confirmed_at";');
    this.addSql('drop table if exists "newsletter_campaign" cascade;');
  }

}
