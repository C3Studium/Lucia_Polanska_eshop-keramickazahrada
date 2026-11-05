/**
 * Pravidla stránky „Dovolená a oznámení" — mimo komponentu, ať se dají zkusit.
 *
 * Proč zvlášť: zapnutý přepínač neznamená, že je upozornění v obchodě vidět,
 * a právě tenhle rozdíl dělal potíže. Dovolená s datem návratu v minulosti se
 * nehlásí a oznámení bez textu se nevydává — obojí se uloží a v obchodě se
 * nestane nic. Dokud to pravidlo bylo schované v JSX, nebylo jak ho ověřit
 * jinak než ručním klikáním v administraci.
 */

/** Dnešní den v Praze jako yyyy-mm-dd — stejný tvar i pásmo jako backend. */
export const prazskyDnes = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(now);

/**
 * Ukazuje obchod dovolenou? Zapnutá A (bez data, nebo ještě před návratem).
 *
 * Den návratu už dovolená není — „Návrat 16. 8." znamená, že 16. 8. je
 * zpátky. Totéž pravidlo má backend v `lib/merchant-settings.ts`
 * (`isVacationActive`) a rozhoduje ono; tady je kopie, protože administrace
 * z backendu importovat nesmí (viz `__tests__/browser-safe-imports`). Mění se
 * obě naráz, stejně jako u osobního odběru v `lib/cp-shipping.ts`.
 */
export const dovolenaVidet = (
  nastaveni: { enabled: boolean; until?: string | null },
  dnes: string = prazskyDnes()
): boolean => {
  if (!nastaveni.enabled) return false;
  const until = nastaveni.until?.trim();
  if (!until) return true;
  return dnes < until;
};

/** Ukazuje obchod oznámení? Zapnuté A s textem — prázdné se nevydává. */
export const oznameniVidet = (nastaveni: {
  enabled: boolean;
  text?: string | null;
}): boolean => Boolean(nastaveni.enabled && nastaveni.text?.trim());

/**
 * Odkaz, jak ho majitelka napíše („naplavka.cz"), na adresu, kterou backend
 * přijme.
 *
 * Zápis bez protokolu je ten nejčastější a `announcement_link` se validuje
 * jako URL — bez `https://` tedy spadlo celé uložení, a to anglickou hláškou
 * o neplatné adrese, které v administraci nikdo nerozumí. Doplnit protokol
 * dělá totéž, co udělá prohlížeč.
 */
export const upravenyOdkaz = (value: string): string => {
  const text = value.trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

/** Je to po úpravě vůbec adresa? Prázdno je v pořádku — pole je nepovinné. */
export const odkazSedi = (value: string): boolean => {
  const text = upravenyOdkaz(value);
  if (!text) return true;
  try {
    return new URL(text).hostname.includes(".");
  } catch {
    return false;
  }
};
