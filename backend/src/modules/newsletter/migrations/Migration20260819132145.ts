import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Drafts, delivery statistics and list hygiene (newsletter editor, 2026-08).
 *
 * Written by hand rather than generated, like the two migrations before it:
 * the production database is only reachable from inside Railway, so there is
 * nothing to diff against. Statements are idempotent (`if not exists`,
 * `drop not null` is a no-op when already nullable), so re-running on boot
 * is safe. The class name is unique across all modules —
 * `src/modules/__tests__/migration-names.unit.spec.ts` enforces it.
 *
 * ## What changes and why
 *
 * - `newsletter_campaign.status` ('draft' | 'sent'): the composer autosaves
 *   into the same table the history reads, so a draft that gets sent
 *   *becomes* its history row instead of leaving a twin behind. The column
 *   default 'sent' is also the backfill — every row that exists today was
 *   sent, that is the only way a row used to appear.
 * - `sent_at` / `recipients` go nullable: a draft has neither, and inventing
 *   values for them would make the history lie.
 * - `newsletter_campaign.tag`: the campaign key sanitised to the mail
 *   service's tag charset, stamped on every outgoing e-mail and stored here
 *   so incoming delivery reports can be matched back to their campaign.
 * - `newsletter_event`: one row per delivery report (delivered / opened /
 *   clicked / bounced / complained). `dedupe_key` (report id + type) is
 *   unique so a retried report can never double-count.
 * - `newsletter_subscriber.suppressed_reason` ('bounce' | 'complaint'):
 *   *why* an address was auto-unsubscribed — undeliverable mailboxes and
 *   spam complaints must drop off the list by themselves, and the admin
 *   shows the reason so the owner is never puzzled by a vanished address.
 */
export class Migration20260819132145 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table if exists "newsletter_campaign" add column if not exists "status" text not null default \'sent\';');
    this.addSql('alter table if exists "newsletter_campaign" add column if not exists "tag" text null;');
    this.addSql('alter table if exists "newsletter_campaign" alter column "sent_at" drop not null;');
    this.addSql('alter table if exists "newsletter_campaign" alter column "recipients" drop not null;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_campaign_status" ON "newsletter_campaign" (status) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_campaign_tag" ON "newsletter_campaign" (tag) WHERE deleted_at IS NULL;');

    this.addSql('alter table if exists "newsletter_subscriber" add column if not exists "suppressed_reason" text null;');

    this.addSql('create table if not exists "newsletter_event" ("id" text not null, "campaign_key" text null, "email" text not null, "type" text not null, "url" text null, "dedupe_key" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_event_pkey" primary key ("id"));');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_event_deleted_at" ON "newsletter_event" (deleted_at) WHERE deleted_at IS NULL;');
    this.addSql('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_event_dedupe_key_unique" ON "newsletter_event" (dedupe_key) WHERE deleted_at IS NULL;');
    this.addSql('CREATE INDEX IF NOT EXISTS "IDX_newsletter_event_campaign_key" ON "newsletter_event" (campaign_key) WHERE deleted_at IS NULL;');
  }

  async down(): Promise<void> {
    this.addSql('alter table if exists "newsletter_campaign" drop column if exists "status";');
    this.addSql('alter table if exists "newsletter_campaign" drop column if exists "tag";');
    this.addSql('alter table if exists "newsletter_subscriber" drop column if exists "suppressed_reason";');
    this.addSql('drop table if exists "newsletter_event" cascade;');
  }

}
