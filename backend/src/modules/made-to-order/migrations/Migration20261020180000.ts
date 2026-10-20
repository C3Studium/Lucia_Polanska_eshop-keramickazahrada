import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Zakázka = POLOŽKA objednávky, ne celá objednávka (LEGAL_AUDIT.md § 0c, Z-A).
 *
 * Dosud měla objednávka nejvýš jednu zakázku (`order_id` unique) a ta nesla
 * celý košík. Od teď je každý zakázkový řádek objednávky vlastní
 * `production_order` s vlastní zálohou, PDF, e-maily, diářem a doplatkem:
 *
 * - `line_item_id` — řádek objednávky, ke kterému zakázka patří. NULL = starý
 *   řádek „celá objednávka" (8 zakázek na produkci) — všude se chová jako
 *   dřív (legacy).
 * - `line_title`, `line_quantity` — název a množství položky v okamžiku
 *   objednání (řádek se může úpravou odebrat, zakázka musí zůstat čitelná).
 * - `line_total` — cena zakázkového řádku po slevě. `original_total` zakázky,
 *   která za objednávku NESE dopravu, balné a běžné zboží (první zakázka
 *   objednávky), je `line_total` + tyto položky; u ostatních = `line_total`.
 *   NULL u legacy řádků (tam je cena položky = `original_total`).
 * - `order_extras_paid` — kolik z toho „navíc" (běžné zboží, poštovné) se
 *   zaplatilo už v pokladně; z toho se počítá, co připadá na samotnou položku.
 *
 * Unikát se mění z `order_id` na `(order_id, line_item_id)`; legacy řádky
 * s NULL se do unikátu nepočítají (Postgres NULL ≠ NULL), ale starý unikát
 * zaručil, že je nejvýš jeden na objednávku.
 *
 * `production_note.production_order_id` — diář per zakázka. Staré zápisy bez
 * něj patří ke všem zakázkám objednávky (= k té jediné legacy).
 */
export class Migration20261020180000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "production_order" add column if not exists "line_item_id" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "line_title" text null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "line_quantity" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_line_quantity" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "line_total" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_line_total" jsonb null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "order_extras_paid" numeric null;`);
    this.addSql(`alter table if exists "production_order" add column if not exists "raw_order_extras_paid" jsonb null;`);

    // Jedna zakázka na objednávku → jedna zakázka na řádek objednávky.
    this.addSql(`alter table if exists "production_order" drop constraint if exists "production_order_order_id_unique";`);
    this.addSql(`drop index if exists "IDX_production_order_order_id_unique";`);
    this.addSql(`create index if not exists "IDX_production_order_order_id" on "production_order" ("order_id") where "deleted_at" is null;`);
    this.addSql(`create index if not exists "IDX_production_order_line_item_id" on "production_order" ("line_item_id") where "deleted_at" is null;`);
    this.addSql(`create unique index if not exists "IDX_production_order_order_id_line_item_id_unique" on "production_order" ("order_id", "line_item_id") where "deleted_at" is null and "line_item_id" is not null;`);

    this.addSql(`alter table if exists "production_note" add column if not exists "production_order_id" text null;`);
    this.addSql(`create index if not exists "IDX_production_note_production_order_id" on "production_note" ("production_order_id") where "deleted_at" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_production_note_production_order_id";`);
    this.addSql(`alter table if exists "production_note" drop column if exists "production_order_id";`);

    this.addSql(`drop index if exists "IDX_production_order_order_id_line_item_id_unique";`);
    this.addSql(`drop index if exists "IDX_production_order_line_item_id";`);
    this.addSql(`drop index if exists "IDX_production_order_order_id";`);
    // Zpět na jednu zakázku na objednávku — projde jen bez objednávek s víc zakázkami.
    this.addSql(`create unique index if not exists "IDX_production_order_order_id_unique" on "production_order" ("order_id") where "deleted_at" is null;`);

    for (const column of [
      "raw_order_extras_paid",
      "order_extras_paid",
      "raw_line_total",
      "line_total",
      "raw_line_quantity",
      "line_quantity",
      "line_title",
      "line_item_id",
    ]) {
      this.addSql(`alter table if exists "production_order" drop column if exists "${column}";`);
    }
  }

}
