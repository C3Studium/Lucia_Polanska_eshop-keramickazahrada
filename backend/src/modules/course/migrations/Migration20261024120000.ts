import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Žádosti o zrušení rezervace kurzu.
 *
 * Do teď mělo zrušení zákazníkem jen dva konce: buď prošlo samo (dřív než
 * 24 h před začátkem, s automatickým vrácením peněz), nebo se odmítlo větou
 * „zavolejte mi prosím". To druhé je přesně to místo, kde chybělo rozhodnutí
 * majitelky — a telefonát se nikde nezapsal.
 *
 * Nově tam vzniká ŽÁDOST: zákazník ji podá, majitelka ji v administraci
 * schválí (s vrácením peněz nebo bez) nebo zamítne. Odpovídá to storno
 * podmínkám, které Matěj určil 20. 10. 2026 — do 24 h předem 100 % zpět,
 * později individuálně.
 *
 * Sloupce sedí na rezervaci, ne do vlastní tabulky: žádost je stav jedné
 * rezervace a v jednu chvíli může být nejvýš jedna.
 *
 * Psáno ručně (generátor nedosáhne na databázi na Railway) a idempotentně,
 * jako ostatní migrace modulu.
 */
export class Migration20261024120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_request_status" text null;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_requested_at" timestamptz null;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_request_note" text null;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_decided_at" timestamptz null;`);
    this.addSql(`alter table if exists "course_reservation" add column if not exists "cancel_decision_note" text null;`);
    // Fronta se čte jako „co čeká na rozhodnutí" — index přesně na to.
    this.addSql(`create index if not exists "IDX_course_reservation_cancel_request_status" on "course_reservation" ("cancel_request_status");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_course_reservation_cancel_request_status";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_decision_note";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_decided_at";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_request_note";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_requested_at";`);
    this.addSql(`alter table if exists "course_reservation" drop column if exists "cancel_request_status";`);
  }

}
