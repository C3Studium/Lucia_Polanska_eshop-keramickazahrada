/**
 * Jméno dokumentu v modulu Dokumenty („Formulář k reklamaci"); prázdné místo
 * se ohlásí v Přehledu. Od 14. 10. 2026 se nabízí jen jako NEPOVINNÁ pomůcka
 * — reklamace jde podat online i bez něj, a není to formulář dopravce, který
 * by zákazník musel vyplnit.
 *
 * Vlastní modul, ne export z `carrier-damage`: ta je klientská komponenta
 * („use client") a serverové stránky z ní místo řetězce dostanou klientskou
 * referenci — dotaz pak šel na `/store/documents/function() { throw … }`
 * a formulář se nikdy nenačetl.
 */
export const CLAIM_FORM_KEY = "reklamacni-formular"
