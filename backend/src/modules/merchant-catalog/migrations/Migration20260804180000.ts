import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds `on_end` to `seasonal_selection`.
 *
 * What should happen to a sale's products when the sale finishes depends on
 * what kind of sale it was: a Christmas collection goes back to full price and
 * keeps selling, a výprodej of damaged pieces is over and the pieces should
 * leave the shop. Defaulting to `keep_selling` is the conservative direction —
 * it never hides something she still wants to sell.
 *
 * Hand-written: `medusa db:generate` diffs against a live database and
 * production is only reachable from inside Railway. Idempotent, so the
 * migrate-on-every-boot deploy is safe.
 */
export class Migration20260804180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seasonal_selection" add column if not exists "on_end" text not null default 'keep_selling';`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "seasonal_selection" drop column if exists "on_end";`
    );
  }

}
