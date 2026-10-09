/**
 * Číselník stavů České pošty → naše fáze (docs/sledovani-zasilek.md §1).
 *
 * ČISTÝ soubor bez závislostí: importují ho unit testy, admin route (texty
 * pro simulaci) i plánovač přechodů. Id stavů jsou z `HistoryState`
 * (contributte/czech-post), texty ověřené živě 9. 10. 2026. Neznámé id se
 * klasifikuje podle textu — ČP číselník občas rozšíří a sledování nesmí
 * ztuhnout na „label" jen proto, že přišel nový kód.
 */

import type { ParcelPhase } from "../../modules/parcel-tracking/phases"

export type { ParcelPhase }

/**
 * Co událost ZNAMENÁ — širší než fáze: `out_of_register` a `not_found` fázi
 * nemění, ale plánovač na ně reaguje (uzavřít / počítat / po 30 dnech vzdát).
 */
export type StateKind =
  | "label"
  | "handed_over"
  | "in_transit"
  | "stored"
  | "delivered"
  | "returned"
  | "problem"
  | "out_of_register"
  | "not_found"

export type StateMeaning = {
  kind: StateKind
  /** `8T` Chybně směrovaná — in_transit, ale stojí za poznámku. */
  misrouted?: boolean
  /** Id známe z číselníku (false = klasifikováno podle textu). */
  known: boolean
}

/** Texty ČP podle id — simulace z nich skládá syntetické události. */
export const CP_STATE_TEXTS: Record<string, string> = {
  "-M": "Obdrženy údaje k zásilce",
  "21": "Podaná zásilka",
  "75": "Přepravovaná zásilka",
  "51": "Vstup na dodací poštu",
  "8D": "Dosílka na jinou adresu",
  "8T": "Chybně směrovaná",
  "82": "Uložená",
  "91": "Doručená",
  "95": "Vrácená",
  "9V": "Doručená odesílateli",
  "8E": "Poškozená",
  "88": "Vyšlá z evidence",
  "-3": "Zásilka tohoto podacího čísla není v evidenci.",
  "-4": "Zásilka se nezobrazuje.",
}

const KNOWN_KINDS: Record<string, StateKind> = {
  "-M": "label",
  "21": "handed_over",
  "75": "in_transit",
  "51": "in_transit",
  "8D": "in_transit",
  "8T": "in_transit",
  "82": "stored",
  "91": "delivered",
  "95": "returned",
  "9V": "returned",
  "8E": "problem",
  "88": "out_of_register",
  "-3": "not_found",
  "-4": "not_found",
}

/** Stavy, které jde v testovacím prostředí nasimulovat z widgetu (§5). */
export const SIMULATABLE_STATES = ["21", "75", "82", "91", "95", "8E"] as const
export type SimulatableState = (typeof SIMULATABLE_STATES)[number]

/**
 * Tatáž simulace ve tvaru nAPI (CISService číselník, ověřeno 9. 10. 2026):
 * `cis:<statusID>/<reasonID>` + oficiální název. S přístupy k nAPI jde ostrá
 * cesta tudy, takže simulace má vkládat PŘESNĚ tenhle tvar — jinak by test
 * ověřoval jinou větev klasifikace než provoz. „Poškozeno" v CIS není;
 * nejbližší problémový stav je ÚLOŽNA (nevyzvednuto, čeká na vrácení).
 */
export const SIMULATED_NAPI_EVENTS: Record<
  SimulatableState,
  { id: string; text: string }
> = {
  "21": { id: "cis:21/00", text: "PODÁNO" },
  "75": { id: "cis:44/01", text: "V PŘEPRAVĚ" },
  "82": { id: "cis:51/20", text: "ULOŽENO" },
  "91": { id: "cis:91/00", text: "DORUČENO" },
  "95": { id: "cis:95/00", text: "VRACÍ SE" },
  "8E": { id: "cis:99/00", text: "ÚLOŽNA BALÍKOVNA" },
}

export const isSimulatableState = (value: unknown): value is SimulatableState =>
  typeof value === "string" &&
  (SIMULATABLE_STATES as readonly string[]).includes(value)

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/**
 * Klasifikace podle textu — pro id mimo tabulku a pro nAPI (`cis:…`), kde je
 * název stavu jediný spolehlivý klíč (oficiální číselník CISService,
 * staženo 9. 10. 2026: ZPRACOVANÁ DATA · PŘEDANÁ DATA · PODÁNO · V PŘEPRAVĚ ·
 * ULOŽENO · ULOŽENO! · DORUČENO · VRACÍ SE · VRÁCENO ODESILATELI ·
 * POŠTOVNÍ ÚLOŽNA / ÚLOŽNA BALÍKOVNA).
 *
 * Pořadí záleží: „Doručená odesílateli" obsahuje „doruč" i „odesílatel" —
 * vrácení musí vyhrát; „úložna" (nevyzvednuto, čeká na vrácení) obsahuje
 * „ulož" — problém musí vyhrát nad „uloženo".
 */
export const classifyByText = (text: string): StateKind => {
  const t = fold(text ?? "")
  if (!t) return "in_transit"
  if (t.includes("data") || t.includes("udaje")) return "label"
  if (t.includes("ulozna")) return "problem"
  if (t.includes("vrac") || t.includes("odesilatel")) return "returned"
  if (t.includes("uloz")) return "stored"
  if (t.includes("doruc") || t.includes("dodan")) return "delivered"
  if (t.includes("podan") || t.includes("prevzat")) return "handed_over"
  if (t.includes("poskoz") || t.includes("problem")) return "problem"
  return "in_transit"
}

export const classifyState = (id: unknown, text?: unknown): StateMeaning => {
  const key = typeof id === "string" ? id.trim() : String(id ?? "")
  const known = KNOWN_KINDS[key]
  if (known) {
    return { kind: known, known: true, ...(key === "8T" ? { misrouted: true } : {}) }
  }
  return { kind: classifyByText(typeof text === "string" ? text : ""), known: false }
}

/**
 * „Jak daleko zásilka došla" — fáze se mění jen na vyšší číslo. `problem`
 * a `returned` tu nejsou: problem se nasazuje, dokud zásilka není hotová
 * (a nepočítá se jako postup), returned je konec bez ohledu na pořadí.
 */
export const PHASE_RANK: Record<ParcelPhase, number> = {
  label: 0,
  handed_over: 1,
  in_transit: 2,
  problem: 2,
  stored: 3,
  delivered: 4,
  returned: 4,
}

export const isTerminalPhase = (phase: ParcelPhase): boolean =>
  phase === "delivered" || phase === "returned"

/** České popisky fází — pro notifikace majitelce a logy. */
export const PHASE_LABEL: Record<ParcelPhase, string> = {
  label: "Štítek",
  handed_over: "Předáno dopravci",
  in_transit: "Na cestě",
  stored: "Uloženo k vyzvednutí",
  delivered: "Převzato zákazníkem",
  returned: "Vráceno",
  problem: "Problém",
}
