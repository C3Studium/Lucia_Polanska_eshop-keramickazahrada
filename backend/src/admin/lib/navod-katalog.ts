/**
 * Návod k adminu — texty (19. 11. 2026). GIFy ke klíčům v `klipy` nahrává
 * tools/navod (scénáře v tools/navod/scenare), backend je drží v navod_klip.
 *
 * Pravidla textu: píše se pro paní Polanskou — česky, bez technických
 * slov, krátké věty, tlačítka přesně tak, jak se v adminu jmenují
 * (v uvozovkách). `proc` = k čemu to je (1–2 věty), `kroky` = co kliknout,
 * `pozor` = na co si dát pozor (jen když je).
 */

export type NavodKlipRef = { klic: string; popis: string };

export type NavodTema = {
  klic: string;
  sekce: NavodSekceId;
  nazev: string;
  proc?: string;
  kroky: string[];
  klipy: NavodKlipRef[];
  pozor?: string;
  /** Kde to v adminu najít (cesta bez /app). */
  kde?: string;
};

export type NavodSekceId =
  | "zacatek"
  | "objednavky"
  | "zakazky"
  | "reklamace"
  | "produkty"
  | "produkt"
  | "zarazeni"
  | "sklad"
  | "kurzy"
  | "poukazy"
  | "slevy"
  | "zakaznici"
  | "komunikace"
  | "nastaveni";

export const SEKCE: { id: NavodSekceId; nazev: string; popis: string }[] = [
  { id: "zacatek", nazev: "Začínáme", popis: "Jak se v adminu pohybovat a co vás dnes čeká." },
  { id: "objednavky", nazev: "Objednávky", popis: "Od nové objednávky po odeslání, odběr a fakturu." },
  { id: "zakazky", nazev: "Zakázky a poptávky", popis: "Výroba na zakázku — zadání, záloha, výroba, doplatek." },
  { id: "reklamace", nazev: "Reklamace a vrácení", popis: "Žádosti zákazníků o vrácení peněz nebo opravu." },
  { id: "produkty", nazev: "Produkty — seznam", popis: "Hledání, filtry a změny u víc výrobků najednou." },
  { id: "produkt", nazev: "Detail výrobku", popis: "Fotky, popis, cena, sklad, doprava a prodej jednoho výrobku." },
  { id: "zarazeni", nazev: "Kolekce a kategorie", popis: "Kde se výrobek v obchodě ukáže." },
  { id: "sklad", nazev: "Sklad", popis: "Kolik kusů máte a co dochází." },
  { id: "kurzy", nazev: "Kurzy", popis: "Termíny kurzů a přihlášky." },
  { id: "poukazy", nazev: "Dárkové poukazy", popis: "Prodané poukazy a jejich uplatnění." },
  { id: "slevy", nazev: "Slevy a výprodeje", popis: "Sleva na výrobek, výprodeje, slevové kódy." },
  { id: "zakaznici", nazev: "Zákazníci a statistiky", popis: "Kdo nakupuje a jak se obchodu daří." },
  { id: "komunikace", nazev: "E-maily a newsletter", popis: "Co zákazníkům chodí a jak poslat novinky." },
  { id: "nastaveni", nazev: "Nastavení obchodu", popis: "Doprava, platby, dovolená, právní údaje a web." },
];

export const NAVOD: NavodTema[] = [
  /* ————————————————— Kolekce a kategorie ————————————————— */
  {
    klic: "zarazeni.co-udelat",
    sekce: "zarazeni",
    nazev: "Přesunout sem, nebo Přidat i sem?",
    proc:
      "Výrobek může být v obchodě na víc místech najednou. „Přesunout sem“ ho dá jen na nové místo (ze starého zmizí). „Přidat i sem“ ho nechá, kde je, a ukáže ho navíc i na novém místě.",
    klipy: [
      { klic: "zarazeni.presunout", popis: "Přesunout sem — výrobek bude JEN na novém místě" },
      { klic: "zarazeni.pridat", popis: "Přidat i sem — výrobek bude na OBOU místech" },
    ],
    kroky: [
      "V „Kolekce a kategorie“ vlevo klikněte na kolekci, kde výrobek teď je.",
      "Zaškrtněte výrobek (nebo víc výrobků).",
      "Klikněte na „Zařadit vybrané“.",
      "Vyberte „Přesunout sem“, nebo „Přidat i sem“.",
      "Vyberte kolekci a pod ní zaškrtněte kategorii.",
      "Dole si přečtěte větu „Po uložení budou…“ a klikněte na „Uložit“.",
    ],
    kde: "/rozdeleni",
  },
];
