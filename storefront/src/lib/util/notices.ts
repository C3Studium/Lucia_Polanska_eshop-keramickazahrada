/**
 * Tvar oznámení pro pás v heru — bez serveru.
 *
 * Oddělené od `@lib/data/notices` ze stejného důvodu, který si u sebe popisuje
 * `@lib/util/site-copy`: tenhle soubor si importuje klientská komponenta
 * (`HeroNotices`), zatímco ten druhý nese `server-only` a sahá přes fetch na
 * backend. Kdyby to byl jeden modul, první `"use client"` komponenta, která si
 * vezme typ `Notice`, by vtáhla do klientského balíku i to čtení a build by
 * spadl na „You're importing a component that needs server-only".
 *
 * Typy se z klientského balíku vytratí samy, funkce ne. Proto je dělicí čára
 * tady, a ne u `import type`.
 */

export type NoticeKind = "vacation" | "announcement"

export type Notice = {
  kind: NoticeKind
  message: string
  /** Jen u novinky, a jen když ji majitelka vyplnila. */
  href?: string | null
  /**
   * Datum návratu z dovolené, už naformátované česky („16. 8. 2026").
   *
   * Hotový řetězec, ne `Date`: formátuje ho server, aby na klientu nevzniklo
   * jiné datum než v HTML, které přišlo ze serveru. `Intl` se řídí locale
   * prostředí, a to se u návštěvníka od serveru běžně liší — což je přesně
   * ta třída rozdílů, kterou React hlásí jako chybu hydratace.
   */
  date?: string | null
}

/** Popisek, kterým se oznámení v pásu uvozuje. */
export const noticeLabel = (kind: NoticeKind): string =>
  kind === "vacation" ? "Dovolená" : "Novinky"
