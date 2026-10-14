import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * `review.verified_purchase` — štítek „Ověřený nákup" jen u recenzí, kde
 * zákazník výrobek opravdu koupil (§ 5 ZOS). Dosud ho storefront ukazoval
 * u každé recenze.
 *
 * Psáno ručně (generátor na DB na Railway nedosáhne). Sloupec má výchozí
 * `false`; stávající recenze se v témže kroku dopočítají stejným pravidlem,
 * jaké používá `modules/product-review/verified-purchase.ts`:
 *
 * 1. nezrušená objednávka (ne koncept) účtu recenzenta s řádkem výrobku, nebo
 * 2. taková objednávka na e-mail účtu, pokud je e-mail ověřený
 *    (`customer.metadata.email_verified`).
 *
 * Dopočet běží jen tam, kde tabulky objednávek a zákazníků existují — na
 * čerstvé databázi (sandbox) může tahle migrace běžet dřív než migrace modulu
 * objednávek, a tam stejně žádná recenze není.
 */
export class Migration20261014153743 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "review" add column if not exists "verified_purchase" boolean not null default false;`
    )

    this.addSql(`
      DO $$
      BEGIN
        IF to_regclass('"order"') IS NOT NULL
          AND to_regclass('order_item') IS NOT NULL
          AND to_regclass('order_line_item') IS NOT NULL THEN
          UPDATE "review" r
          SET "verified_purchase" = true
          WHERE r."verified_purchase" = false
            AND r."customer_id" IS NOT NULL
            AND r."deleted_at" IS NULL
            AND EXISTS (
              SELECT 1
              FROM "order" o
              JOIN "order_item" oi
                ON oi."order_id" = o."id"
               AND oi."version" = o."version"
               AND oi."deleted_at" IS NULL
              JOIN "order_line_item" li
                ON li."id" = oi."item_id"
               AND li."deleted_at" IS NULL
              WHERE o."customer_id" = r."customer_id"
                AND li."product_id" = r."product_id"
                AND o."deleted_at" IS NULL
                AND o."is_draft_order" = false
                AND o."status" NOT IN ('canceled', 'draft')
            );

          IF to_regclass('customer') IS NOT NULL THEN
            UPDATE "review" r
            SET "verified_purchase" = true
            WHERE r."verified_purchase" = false
              AND r."customer_id" IS NOT NULL
              AND r."deleted_at" IS NULL
              AND EXISTS (
                SELECT 1
                FROM "customer" c
                JOIN "order" o
                  ON lower(trim(o."email")) = lower(trim(c."email"))
                JOIN "order_item" oi
                  ON oi."order_id" = o."id"
                 AND oi."version" = o."version"
                 AND oi."deleted_at" IS NULL
                JOIN "order_line_item" li
                  ON li."id" = oi."item_id"
                 AND li."deleted_at" IS NULL
                WHERE c."id" = r."customer_id"
                  AND c."email" IS NOT NULL
                  AND c."metadata"->>'email_verified' = 'true'
                  AND li."product_id" = r."product_id"
                  AND o."deleted_at" IS NULL
                  AND o."is_draft_order" = false
                  AND o."status" NOT IN ('canceled', 'draft')
              );
          END IF;
        END IF;
      END $$;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "review" drop column if exists "verified_purchase";`
    )
  }

}
