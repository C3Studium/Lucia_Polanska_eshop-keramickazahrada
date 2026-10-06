import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006170000 extends Migration {

  override async up(): Promise<void> {
    // Jedno odeslání = JEDEN řádek s polem fotek (`images`), ne N řádků slepených
    // přes `batch_id`. Čtení spadne na staré `image_url`, takže stará data není
    // potřeba přepisovat — sloupec jen přibude.
    this.addSql(`alter table if exists "production_note" add column if not exists "images" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "production_note" drop column if exists "images";`);
  }

}
