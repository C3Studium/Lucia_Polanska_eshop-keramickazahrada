/*
 * Přišel člověk na tuhle stránku tlačítkem Zpět?
 *
 * Odpověď rozhoduje o tom, kde stránka začne. Běžný přechod (klik v menu,
 * odkaz) má začít nahoře. Návrat zpět má naopak vrátit člověka tam, kde
 * přestal — v katalogu k výrobku, na který klikal.
 *
 * Rozlišit to jinak nejde: po přechodu uvnitř aplikace se `document.referrer`
 * nemění a `performance.navigation` mluví jen o celém načtení stránky. Jediná
 * událost, která o pohybu v historii ví, je `popstate` — a ta přijde ještě na
 * STARÉ stránce, než se nová vůbec připojí.
 *
 * Proto razítko v `sessionStorage`, ne proměnná v modulu: čtenářů je víc
 * (odrolování nahoru v kořenovém layoutu, obnova katalogu uvnitř stránky)
 * a pořadí jejich efektů React negarantuje. Razítko nikdo nespotřebovává,
 * zastará samo — 1,5 s je na přechod mezi stránkami dost a zároveň tak málo,
 * že se o něj nemůže opřít žádná pozdější navigace.
 */

const KLIC = "nav:zpet"

/** Jak dlouho po stisku Zpět razítko platí. */
const PLATNOST_MS = 1500

/**
 * Začne sledovat pohyb v historii. Volá se jednou, z kořenového layoutu;
 * vrací úklid pro `useEffect`.
 */
export const sledujNavigaciZpet = (): (() => void) => {
  if (typeof window === "undefined") return () => {}

  const zapis = () => {
    try {
      window.sessionStorage.setItem(KLIC, String(Date.now()))
    } catch {
      /* Soukromé okno nebo plná kvóta. Bez razítka se stránka chová jako při
         běžném přechodu — začne nahoře. To je ta bezpečnější polovina. */
    }
  }

  window.addEventListener("popstate", zapis)
  return () => window.removeEventListener("popstate", zapis)
}

/*
 * Obnovení stránky (F5, tah dolů na telefonu, Safari, které stránku zahodilo
 * a načítá ji znovu).
 *
 * `performance` ví jen o načtení CELÉHO dokumentu — po přechodu uvnitř
 * aplikace pořád hlásí „reload", když se tak dokument kdysi načetl. Proto
 * platí jen do první navigace v aplikaci; tu nahlásí `ScrollResetOnRoute`.
 */
let bylaNavigaceVAplikaci = false

export const zaznamenejNavigaciVAplikaci = () => {
  bylaNavigaceVAplikaci = true
}

/** Je tahle stránka právě obnovená (a ne otevřená odkazem v aplikaci)? */
export const jeObnoveniStranky = (): boolean => {
  if (typeof window === "undefined" || bylaNavigaceVAplikaci) return false
  try {
    const zaznam = window.performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined
    return zaznam?.type === "reload"
  } catch {
    return false
  }
}

/** Přišli jsme sem tlačítkem Zpět (nebo Vpřed)? */
export const prisliJsmeZpet = (): boolean => {
  if (typeof window === "undefined") return false

  try {
    const razitko = Number(window.sessionStorage.getItem(KLIC))
    if (!razitko) return false
    return Date.now() - razitko < PLATNOST_MS
  } catch {
    return false
  }
}
