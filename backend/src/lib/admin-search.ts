/**
 * Hledání odkudkoli v administraci (Ctrl+K) — co se z napsaného dá poznat.
 *
 * Čistá funkce bez kontejneru, ať jde ověřit testem: route
 * `api/admin/search` podle výsledku rozhodne, které dotazy vůbec pustí.
 * Dotazů je pět a každý má limit; zbytečné (kód poukazu u „Novák") se
 * nepouštějí, aby okno odpovídalo hned.
 */

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 80
/** Výsledků na druh — okno je malé a vybírá se z něj jedno. */
export const SEARCH_LIMIT_PER_KIND = 5

export type ParsedSearch = {
  /** Oříznutý text; prázdný = nic nehledat. */
  text: string
  /** „123" nebo „#123" → číslo objednávky. */
  orderNumber: number | null
  /** Kód poukazu bez mezer a pomlček (3+ znaky z písmen a číslic). */
  voucherCode: string | null
  /** Podací číslo ČP (např. DR1234567890U) — písmena + aspoň 6 číslic. */
  parcelCode: string | null
  /** Text pro hledání v názvech a jménech (ne čisté číslo). */
  words: string | null
}

const EMPTY: ParsedSearch = {
  text: "",
  orderNumber: null,
  voucherCode: null,
  parcelCode: null,
  words: null,
}

export const parseSearchQuery = (raw: unknown): ParsedSearch => {
  const text = String(raw ?? "").trim().slice(0, SEARCH_MAX_LENGTH)
  if (text.length < SEARCH_MIN_LENGTH && !/^#?\d+$/.test(text)) {
    return { ...EMPTY, text: "" }
  }

  const numberMatch = text.match(/^#?\s*(\d{1,9})$/)
  const orderNumber = numberMatch ? Number(numberMatch[1]) : null

  // Kód poukazu se opisuje z papíru („7hq4-m2xp") — velikost písmen, mezery
  // a pomlčky nehrají roli (`normalizeVoucherCode`). Čisté číslo to není:
  // to je číslo objednávky.
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const voucherCode =
    !orderNumber && compact.length >= 3 && compact.length <= 16 && /^[A-Za-z0-9\s-]+$/.test(text)
      ? compact
      : null

  const parcelCode = /^[A-Z]{2}\d{6,}[A-Z]{0,2}$/.test(compact) ? compact : null

  return {
    text,
    orderNumber: orderNumber && orderNumber > 0 ? orderNumber : null,
    voucherCode,
    parcelCode,
    words: orderNumber ? null : text,
  }
}

/** `%…%` pro ILIKE — zástupné znaky z hledaného textu se berou doslova. */
export const likePattern = (value: string): string =>
  `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
