/**
 * Obchod prodává ve dvou měnách: koruna a euro (5. 11. 2026).
 *
 * Lucie zadává ceny v korunách, euro z nich dopočítá denní lístek ČNB
 * (`jobs/sync-currency-prices`). Zákazník mimo Česko platí v eurech — Polák,
 * Slovák i Brit. Žádná třetí měna: každá znamená vlastní měnový účet
 * v ComGate (jinak banka převádí podle svého kurzu) a vlastní číselnou řadu
 * v iDokladu, a ani jedno Lucie nemá.
 *
 * Produkce měla do 5. 11. 2026 vlastní region „Polsko" se zlotým a denně
 * přepočítávanými cenami. Zlotý se tím pádem objevoval i v pokladně, přestože
 * ho nebylo kam poslat; Polsko je teď v eurovém regionu.
 *
 * Seznam je tu proto, aby se dalo strojově poznat, že se obchod vrátil
 * k další měně — zapnout ji jde v administraci dvěma kliknutími a nikde by to
 * jinak nebylo vidět. Hlídá to kontrola `meny` (provozni-hlidka/kontroly).
 */
export const MENY_OBCHODU = ["czk", "eur"] as const

export type MenaObchodu = (typeof MENY_OBCHODU)[number]

/** Výchozí měna: v ní se zadávají ceny a od ní se kurzem odvozují ostatní. */
export const MENA_ZAKLADNI: MenaObchodu = "czk"

export const jeMenaObchodu = (kod: unknown): boolean =>
  typeof kod === "string" &&
  (MENY_OBCHODU as readonly string[]).includes(kod.trim().toLowerCase())

/** „CZK a EUR" — do hlášek, ať se seznam nepíše na dvou místech jinak. */
export const vypisMen = (): string =>
  MENY_OBCHODU.map((mena) => mena.toUpperCase()).join(" a ")
