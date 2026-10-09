import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Položky žádosti a poškození přepravou (docs/reklamace-a-zruseni.md §11.1).
 *
 * `line_items` = snapshot vybraných řádků objednávky
 * `[{ line_item_id, title, variant_title, thumbnail, quantity, unit_price,
 * total, currency_code }]` s cenou PO slevě a S DPH — z něj se počítá výchozí
 * částka refundace („cena vybraných položek"). Snapshot, ne odkaz: objednávka
 * se může ještě upravit a žádost má říkat, co zákazník reklamoval tehdy.
 * Stará textová `items` zůstává jako záloha pro staré řádky a záložní routu.
 *
 * `damage_cause` = `"carrier"` (zásilka dorazila poškozená) — spouští
 * upozornění majitelce, ať reklamuje u České pošty včas.
 */
export class Migration20261009180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "return_request" add column if not exists "line_items" jsonb null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "damage_cause" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request" drop column if exists "line_items";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "damage_cause";`);
  }

}
