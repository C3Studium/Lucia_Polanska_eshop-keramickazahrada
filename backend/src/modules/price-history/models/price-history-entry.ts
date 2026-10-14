import { model } from "@medusajs/framework/utils"

/**
 * Jeden den ceny jedné varianty v jedné měně — podklad pro § 12a zákona
 * o ochraně spotřebitele („nejnižší cena za 30 dní před slevou").
 *
 * ## Proč samostatná tabulka
 *
 * `price-watch` drží jen POSLEDNÍ cenu sledovaných variant a staré řádky maže;
 * zákon se ale ptá na minulost (30 dní před začátkem slevy) a u všech
 * zlevněných kusů, ne jen u těch v oblíbených. Tady se proto nic nepřepisuje
 * dozadu a nic se nemaže — tabulka je zároveň doklad pro případnou kontrolu.
 *
 * ## Co řádek znamená
 *
 * - `kind = "base"` — běžná cena (variantní cena bez price-listu typu sleva,
 *   tj. `calculated_price.original_amount`).
 * - `kind = "sale"` — akční cena z price-listu typu „sale", jen když je opravdu
 *   nižší než běžná.
 * - `recorded_on` — kalendářní den v Europe/Prague (`YYYY-MM-DD`). Text, ne
 *   datum: Medusa DML datum bez času nemá a řetězec v tomhle tvaru se řadí
 *   i porovnává správně.
 * - `amount` — NEJNIŽŠÍ částka, kterou job ten den u varianty viděl. Job běží
 *   víckrát denně a řádek dne jen „posouvá dolů"; zdražení během dne se tak
 *   projeví až zítřejším řádkem. Pro nejnižší cenu za 30 dní je to přesně
 *   správně: cena, za kterou se ten den aspoň chvíli prodávalo, se počítá.
 *
 * Kusy s vadou („Poškozené") tu mají jen svou skutečnou cenu jako `base`.
 * Jejich `clearance_original_price` je cena nepoškozeného kusu, ne předchozí
 * cena tohohle kusu — sleva to není a § 12a se na ně nevztahuje.
 */
const PriceHistoryEntry = model
  .define("price_history_entry", {
    id: model.id({ prefix: "phe" }).primaryKey(),
    variant_id: model.text(),
    currency_code: model.text(),
    kind: model.enum(["base", "sale"]),
    amount: model.bigNumber(),
    price_list_id: model.text().nullable(),
    recorded_on: model.text(),
  })
  .indexes([
    {
      // Jeden řádek na variantu, měnu, druh a den — job je díky tomu
      // idempotentní a souběžné běhy se nezdvojí. Index začíná `variant_id`,
      // takže slouží i dotazu storefrontu (varianty + měna + od data).
      name: "IDX_price_history_entry_unique_day",
      on: ["variant_id", "currency_code", "kind", "recorded_on"],
      unique: true,
    },
    {
      // Job si na začátku načte všechny řádky dneška.
      name: "IDX_price_history_entry_recorded_on",
      on: ["recorded_on"],
    },
  ])

export default PriceHistoryEntry
