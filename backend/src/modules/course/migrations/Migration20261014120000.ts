import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Souhlasy u webové rezervace kurzu (právní audit § 5):
 *
 * `course_reservation.consents` — verze obchodních podmínek, čas souhlasu
 * (serverový i z prohlížeče), poučení o výjimce z odstoupení (§ 1837 písm. j)
 * OZ), nepovinný souhlas s fotkami a otisk zobrazených storno podmínek.
 * Nullable: ruční rezervace a řádky z doby před touhle migrací souhlas nemají.
 *
 * Psáno ručně (generátor nedosáhne na databázi na Railway) a idempotentně,
 * jako ostatní migrace modulu.
 */
export class Migration20261014120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" add column if not exists "consents" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" drop column if exists "consents";`);
  }

}
