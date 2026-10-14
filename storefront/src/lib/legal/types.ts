/**
 * Právní dokumenty obchodu — datový tvar.
 *
 * Dokumenty žijí v repu jako verzované moduly (`./documents/<slug>/<verze>.ts`),
 * ne v CMS: jejich znění se váže k objednávce (verze OP v `order.metadata`),
 * generuje se z nich PDF a čte je advokát v PR. CMS by je přepisovalo
 * odstavec po odstavci podle pořadí a pole má strop 1000 znaků — viz
 * docs/legal/CHANGELOG.md.
 *
 * ## Vnořený text (inline)
 *
 * Řetězce v blocích smí obsahovat jen tuto značku (vykresluje ji
 * `./inline.tsx` — stejně na webu, v tisku do PDF i v testech):
 *
 * - `**tučně**`
 * - `[text odkazu](/smluvni-podminky#odstoupeni)` — interní cesta bez `/cz`
 *   (doplní se), nebo absolutní `https://…`, `mailto:…`, `tel:…`
 * - `[[DOPLNIT: co chybí]]` — zvýrazněný zástupný text pro údaj, který
 *   zadavatel ještě nedodal (zapsaný v docs/legal/OPEN_QUESTIONS.md).
 *   NIKDY nenahrazovat vymyšlenou hodnotou.
 * - `{{fakt}}` — hodnota z `./facts.ts` (např. `{{seller.name}}`); když fakt
 *   chybí, vykreslí se jako `[[DOPLNIT: …]]`.
 */

/** Klíč dokumentu = trvalý identifikátor (nemění se s verzí ani s URL). */
export type LegalSlug =
  | "obchodni-podminky"
  | "reklamacni-rad"
  | "reklamacni-protokol"
  | "odstoupeni-od-smlouvy"
  | "ochrana-osobnich-udaju"
  | "cookies"
  | "doprava-a-platba"

export type LegalBlock =
  /** Odstavec. */
  | { type: "p"; text: string }
  /** Odrážky / číslovaný seznam. */
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  /** Tabulka (např. zpracování osobních údajů, cookies, ceník). */
  | { type: "table"; caption?: string; head: string[]; rows: string[][] }
  /** Zvýrazněný rámeček — vzorové poučení, důležité upozornění. */
  | { type: "box"; title?: string; blocks: LegalBlock[] }
  /**
   * Vyplnitelný formulář do PDF / k tisku: řádky s popiskem a místem na
   * vyplnění. `value` = předvyplněný text (např. adresát).
   */
  | { type: "form"; title?: string; fields: { label: string; value?: string }[]; note?: string }

export type LegalSection = {
  /** Kotva v URL (`#id`) — po vydání ji neměnit, odkazuje se na ni z e-mailů. */
  id: string
  /** Nadpis kapitoly, např. „V. Odstoupení od kupní smlouvy". */
  title: string
  blocks: LegalBlock[]
}

export type LegalDocumentVersion = {
  slug: LegalSlug
  /** Název dokumentu, např. „Obchodní podmínky". */
  title: string
  /**
   * Verze = datum účinnosti `YYYY-MM-DD`. Je to i klíč, který se ukládá
   * k objednávce (`terms_version`) a část názvu PDF.
   */
  version: string
  /** Krátký úvod pod nadpisem (jedna-dvě věty, lidsky). */
  summary?: string
  sections: LegalSection[]
  /** Generuje se z verze PDF ke stažení / do přílohy e-mailu? */
  pdf: boolean
  /**
   * Archivní verze — zůstává dostupná na vlastní URL kvůli objednávkám,
   * které se podle ní uzavíraly. Na hlavní stránce dokumentu se nezobrazuje.
   */
  archived?: boolean
}

/** Záznam o vygenerovaném PDF (`pdf-manifest.json`, plní `pnpm legal:build`). */
export type LegalPdfEntry = {
  slug: LegalSlug
  version: string
  /** Název souboru, např. `obchodni-podminky-2026-10-15.pdf`. */
  file: string
  /** Veřejná trvalá URL (úložiště R2), nebo cesta `/legal/<file>` na storefrontu. */
  url: string
  sha256: string
  bytes: number
}
