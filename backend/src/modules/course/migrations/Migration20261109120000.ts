import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Chybějící `raw_price_child` (9. 11. 2026).
 *
 * `price_child` je v modelu `model.bigNumber()`, a ten Medusa ukládá do DVOU
 * sloupců: číslo a vedle něj `raw_<název>` (jsonb s přesnou hodnotou).
 * Migrace 20261108120000 přidala jen číslo, takže každý dotaz, který termín
 * načítá přes vazbu, padal na „column t1.raw_price_child does not exist" —
 * zrušení termínu, žádosti o místo a o zrušení, zakládání termínů. V adminu
 * se to ukazovalo jako „Záznam už neexistuje".
 *
 * Doplnění z `price_child` je pojistka pro řádky, které by cenu za dítě
 * mezitím dostaly jinou cestou; v produkci jich bylo 0 z 15.
 * Psáno ručně a idempotentně.
 */
export class Migration20261109120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_term" add column if not exists "raw_price_child" jsonb null;`);
    this.addSql(
      `update "course_term" set "raw_price_child" = jsonb_build_object('value', "price_child"::text, 'precision', 20) where "price_child" is not null and "raw_price_child" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_term" drop column if exists "raw_price_child";`);
  }
}
