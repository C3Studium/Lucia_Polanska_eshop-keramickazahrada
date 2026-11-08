import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Kolik z rezervace jsou děti (8. 11. 2026). Místa zabírají jako kdokoli
 * jiný, jen platí dětskou cenu termínu. Výchozí nula, aby starší rezervace
 * zůstaly přesně tím, čím byly. Psáno ručně a idempotentně.
 */
export class Migration20261108130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" add column if not exists "children" integer not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" drop column if exists "children";`);
  }
}
