import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Adds `allow_full_prepayment` to `product_production_profile`.
 *
 * Lets checkout offer „zaplatit celou částku rovnou" per product. Defaults to
 * `true` so existing commissions gain the option without anyone editing them
 * one at a time; she can turn it off for pieces where taking six weeks of money
 * up front is not something she wants.
 *
 * Written by hand rather than generated: `medusa db:generate` diffs against a
 * live database, and the production one is only reachable from inside Railway.
 * The statement is idempotent (`add column if not exists`), so re-running it —
 * which the deploy does on every boot — is safe.
 */
export class Migration20260804120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_production_profile" add column if not exists "allow_full_prepayment" boolean not null default true;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_production_profile" drop column if exists "allow_full_prepayment";`
    );
  }

}
