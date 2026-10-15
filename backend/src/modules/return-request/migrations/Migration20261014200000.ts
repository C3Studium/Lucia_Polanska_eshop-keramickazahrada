import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Odstoupení od smlouvy online (§ 1830a OZ) a potvrzení reklamace (§ 19 ZOS).
 *
 * `submitted_at` = okamžik, kdy zákazník žádost odeslal (čas serveru při
 * přijetí) — potvrzení odstoupení ho musí nést spolu s obsahem; u reklamace je
 * to den uplatnění, od kterého běží 30 dnů. `channel` = kudy žádost přišla
 * (`online`). `takeover_at` = převzetí zboží, ze kterého se počítala 14denní
 * lhůta (snapshot vedle `withdrawal_deadline`).
 *
 * Vlastní sloupce, ne json: datum a čas odeslání je právně podstatný údaj
 * (důkaz včasnosti odstoupení), má být dotazovatelný a typovaný jako ostatní
 * razítka žádosti (`resolved_at`, `goods_received_at`). Starší řádky zůstanou
 * null — čtenáři pak berou `created_at`.
 */
export class Migration20261014200000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "return_request" add column if not exists "submitted_at" timestamptz null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "channel" text null;`);
    this.addSql(`alter table if exists "return_request" add column if not exists "takeover_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request" drop column if exists "submitted_at";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "channel";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "takeover_at";`);
  }

}
