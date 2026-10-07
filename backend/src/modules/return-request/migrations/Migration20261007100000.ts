import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Modul „Reklamace a zrušení" (docs/reklamace-a-zruseni.md §2): nová pole a
 * rozšířený stavový automat `pending → approved → received → resolved |
 * rejected | cancelled`.
 *
 * Základní migrace (Migration20260805100000) vytvořila `status` s inline CHECK
 * na tři staré hodnoty — Postgres ho pojmenoval `return_request_status_check`.
 * Nový stav by na něm spadl, takže se CHECK shodí a založí znovu se šesti
 * hodnotami. Shazuje se přes katalog (ne jen podle jména), kdyby ho někdy
 * MikroORM pojmenoval jinak.
 */
export class Migration20261007100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "return_request" add column if not exists "requested_resolution" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "resolution" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "goods_received_at" timestamptz null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "goods_tracking" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "resolved_at" timestamptz null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "resolution_note" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "refunds" jsonb null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "withdrawal_deadline" timestamptz null;`);

    // CHECK na `status`: pryč se starým (3 hodnoty), nový se šesti.
    this.addSql(`DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'return_request'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE "return_request" DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;`);
    this.addSql(`alter table if exists "return_request" add constraint "return_request_status_check" check ("status" in ('pending', 'approved', 'received', 'resolved', 'rejected', 'cancelled'));`);
  }

  override async down(): Promise<void> {
    // Řádky v nových stavech by starý CHECK neprošly — napřed je sklopit.
    this.addSql(`update "return_request" set "status" = 'approved' where "status" in ('received', 'resolved');`);
    this.addSql(`update "return_request" set "status" = 'rejected' where "status" = 'cancelled';`);
    this.addSql(`alter table if exists "return_request" drop constraint if exists "return_request_status_check";`);
    this.addSql(`alter table if exists "return_request" add constraint "return_request_status_check" check ("status" in ('pending', 'approved', 'rejected'));`);

    this.addSql(`alter table if exists "return_request" drop column if exists "requested_resolution";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "resolution";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "goods_received_at";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "goods_tracking";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "resolved_at";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "resolution_note";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "refunds";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "withdrawal_deadline";`);
  }

}
