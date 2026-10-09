import { model } from "@medusajs/framework/utils"
import { PARCEL_PHASES } from "../phases"

/**
 * Sledovaná zásilka České pošty — jedna na objednávku (docs/sledovani-zasilek.md §2).
 *
 * Řádek vzniká s číslem zásilky (po vygenerování štítku, nebo ručně z widgetu)
 * a pak ho krmí job `watch-parcel-tracking` z veřejného JSON ČP. Ukládá se
 * surová historie (`events`, append-only) i odvozené razítka `*_at`, aby se
 * z nich dalo číst bez znovuprocházení historie: recenze čte `delivered_at`,
 * widget kreslí stepper z razítek. Rozdělené zásilky (dvě čísla na objednávku)
 * neřešíme — proto je `order_id` unikátní.
 */
const ParcelTracking = model.define("parcel_tracking", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  /** Zatím jediný dopravce se sledováním. Text, ne enum — ať jde přidat další bez migrace. */
  carrier: model.text().default("ceska-posta"),
  /** Podací číslo z `order.metadata.cp_label_tracking`. */
  parcel_code: model.text(),
  /** `NB` (Balíkovna) / `DR` (Do ruky) — kvůli názvu dopravce v e-mailu a widgetu. */
  service_code: model.text().nullable(),
  phase: model.enum([...PARCEL_PHASES]).default("label"),
  /**
   * `[{ id, text, date, postoffice?, postcode?, source: "cp" | "simulated", seen_at }]`
   * — append-only, dedupe podle id+date+text (ČP má jen datum, ne čas).
   */
  events: model.json().default([] as unknown as Record<string, unknown>),
  /** První `21` (Podaná zásilka) — okamžik „předáno dopravci". */
  handed_over_at: model.dateTime().nullable(),
  /** První `82` (Uložená) — čeká na vyzvednutí. */
  stored_at: model.dateTime().nullable(),
  /** `91` (Doručená) — odsud běží týden do prosby o recenzi. */
  delivered_at: model.dateTime().nullable(),
  /** `95` / `9V` — zásilka se vrátila. */
  returned_at: model.dateTime().nullable(),
  last_state_id: model.text().nullable(),
  last_state_text: model.text().nullable(),
  last_checked_at: model.dateTime().nullable(),
  check_count: model.number().default(0),
  /** Už se nedotazovat: doručeno / vráceno / vyšlo z evidence / vzdáno. */
  done: model.boolean().default(false),
  /** Např. „test label" nebo „vzdáno po 30 dnech". */
  note: model.text().nullable(),
}).indexes([
  {
    on: ["done"],
  },
])

export default ParcelTracking
