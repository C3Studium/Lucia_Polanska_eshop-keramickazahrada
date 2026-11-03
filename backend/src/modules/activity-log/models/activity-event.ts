import { model } from "@medusajs/framework/utils"

/**
 * Jedna věc, která se v obchodě stala (3. 11. 2026).
 *
 * ## Proč to existuje
 *
 * Obchod dělá velkou část práce na pozadí: platba dorazí notifikační URL,
 * fakturu vystaví subscriber, štítek podá úloha, e-mail odešle poskytovatel.
 * Když něco z toho tiše vynechá, nepřijde chyba — jen se něco nestane.
 * Objednávka #68 je ten případ: platba přišla, faktura ne, a zjistilo se to
 * až za týden. Mezi „funguje" a „nefunguje" je ticho, a ticho nejde sledovat.
 *
 * Deník to ticho mění na řádky. Zapisuje se úspěch i selhání, protože otázka
 * nebývá „co spadlo", ale „proběhlo vůbec něco?" — a na tu odpoví jen záznam,
 * který vznikne i tehdy, když je všechno v pořádku.
 *
 * ## Co se zapisuje a co ne
 *
 * Zapisuje se, CO se stalo a JAK to skončilo: druh, akce, stav, koho se to
 * týká a přesné podrobnosti k dohledání. **Nikdy obsah požadavku** — v tělech
 * jdou hesla, platební údaje a osobní data, a deník je to poslední místo,
 * kde mají ležet měsíc. Na opravu chyby stačí cesta, stav a identifikátor.
 *
 * Čtení (GET) se nezapisuje, dokud neselže. Jinak by deník byl z devíti
 * desetin výpis prohlížení administrace a to podstatné by se v něm utopilo.
 */
export const ActivityEvent = model.define("activity_event", {
  id: model.id({ prefix: "ae" }).primaryKey(),
  /**
   * Hrubá škatulka do souhrnu: `platba`, `email`, `objednavka`, `reklamace`,
   * `prihlaseni`, `admin`, `obchod`, `uloha`, `web`, `zakazka`, `poukaz`,
   * `kurz`, `faktura`. Text, ne výčet: nový druh se nesmí zadrhnout o migraci
   * v okamžiku, kdy je potřeba ho začít sledovat.
   */
  kind: model.text(),
  /**
   * Co přesně: `payment.captured`, `PUT /admin/products/:id`, `job:watch-provoz`,
   * `login`. Drží se stabilní tvar, aby se dalo počítat „kolikrát dnes".
   */
  action: model.text(),
  /** `ok` nebo `chyba` — nic mezi tím, aby se souhrn dal sečíst. */
  status: model.text(),
  /**
   * Kdo to způsobil: `admin:<id uživatele>`, `zákazník`, `systém`. Bez
   * e-mailů a jmen — na dohledání stačí identifikátor, a deník není
   * evidence lidí.
   */
  actor: model.text().nullable(),
  /** `order`, `product`, `return_request`, … — čeho se to týká. */
  ref_type: model.text().nullable(),
  ref_id: model.text().nullable(),
  /** Jedna věta česky do souhrnu a do e-mailu. */
  summary: model.text().nullable(),
  /**
   * Přesné podrobnosti k dohledání: stavový kód, text výjimky, číslo
   * objednávky, klíč metadat. To, co má smysl vložit do chatu.
   */
  detail: model.json().nullable(),
  /** Jak dlouho to trvalo (ms) — pomalá věc je taky druh poruchy. */
  duration_ms: model.number().nullable(),
})

export default ActivityEvent
