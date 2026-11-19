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
  /* ————————————————— Produkty — seznam ————————————————— */
  {
    klic: "produkty.novy",
    sekce: "produkty",
    nazev: "Založit nový výrobek",
    proc:
      "Nový výrobek se založí jako SKRYTÝ — zákazníci ho neuvidí, dokud nedoplníte fotky a popis a nekliknete na „Zveřejnit v obchodě“.",
    klipy: [{ klic: "produkty.novy", popis: "Nový výrobek od začátku" }],
    kroky: [
      "Produkty → „Přidat produkt“.",
      "Vyberte druh: „Produkt“ (běžný), „Na zakázku“, „Poškozený kus“, nebo „Balíček“.",
      "Napište název a cenu, vyberte kolekci a kategorii.",
      "Klikněte na „Založit a otevřít“ — otevře se detail výrobku.",
      "Nahrajte fotky, dopište popis a nahoře v oranžovém pruhu klikněte na „Zveřejnit v obchodě“.",
    ],
    kde: "/novy-produkt",
  },
  {
    klic: "produkty.seznam",
    sekce: "produkty",
    nazev: "Hledat a filtrovat výrobky",
    proc:
      "Seznam všech výrobků. Hledáte podle názvu, filtrujete podle kolekce, kategorie, stavu a dopravy. Klik na řádek otevře výrobek, štítky ve sloupci Doprava změníte rovnou v řádku.",
    klipy: [
      { klic: "produkty.hledat", popis: "Hledání a filtr" },
      { klic: "produkty.doprava-radek", popis: "Doprava rovnou v řádku" },
      { klic: "produkty.skryt", popis: "Skrýt a zase zobrazit" },
    ],
    kroky: [
      "Do pole „Hledat název…“ napište část názvu.",
      "Filtry „Kolekce“, „Kategorie“, „Stav“, „Doprava“ zúží seznam; pamatují si to i po návratu z detailu.",
      "Klik na štítky ve sloupci Doprava (balné, Malé/Velké, dobírka) je změní bez otevírání výrobku.",
      "„…“ na konci řádku: skrýt / zobrazit v obchodě, profil dopravy, provedení a ceny, archiv.",
    ],
    kde: "/produkty-workbench",
  },
  {
    klic: "produkty.hromadne",
    sekce: "produkty",
    nazev: "Hromadné změny (víc výrobků najednou)",
    proc:
      "Když chcete víc výrobkům nastavit totéž — křehké, dobírku, balné, slevu, výprodej, kolekci… Zaškrtnete je a v panelu vpravo změníte jen to, co mají mít stejné. Nic se neuloží, dokud nekliknete na „Uložit vše“.",
    klipy: [{ klic: "produkty.hromadne", popis: "Dvěma výrobkům zapnout Křehké" }],
    kroky: [
      "Zaškrtněte aspoň dva výrobky (políčko vlevo u řádku).",
      "Dole se objeví lišta — klikněte na „Hromadné změny“.",
      "V panelu změňte, co potřebujete (Doprava, Prodej, Slevy, Zařazení). „Beze změny“ = nechat, jak je.",
      "Klikněte na „Uložit vše“.",
    ],
    pozor: "Rychlé „Skrýt z obchodu / Zobrazit v obchodě“ je přímo v liště dole a platí hned.",
    kde: "/produkty-workbench",
  },
  /* ————————————————— Detail výrobku ————————————————— */
  {
    klic: "produkt.zverejnit",
    sekce: "produkt",
    nazev: "Zveřejnit a skrýt výrobek",
    proc:
      "Skrytý výrobek (oranžový rámeček a pruh nahoře) zákazníci nevidí — není v kolekcích, kategoriích ani ve vyhledávání a nejde koupit. Zveřejněný má zelený štítek „Publikováno“.",
    klipy: [{ klic: "produkt.zverejnit", popis: "Zveřejnit a zase skrýt" }],
    kroky: [
      "Otevřete výrobek (Produkty → klik na řádek).",
      "Skrytý výrobek má nahoře oranžový pruh — klikněte v něm na „Zveřejnit v obchodě“.",
      "Skrýt ho jde vpravo nahoře přes „…“ → „Skrýt z obchodu“.",
    ],
    pozor: "Když výrobek „v obchodě není“, i když má správnou kolekci, zkontrolujte nejdřív, jestli není skrytý.",
    kde: "/produkty-workbench",
  },
  {
    klic: "produkt.fotky",
    sekce: "produkt",
    nazev: "Fotky výrobku",
    proc:
      "První fotka je hlavní — ukazuje se v obchodě na kartě výrobku. Fotky nahrajete tlačítkem nebo je přetáhnete myší ze složky v počítači rovnou do oddílu Fotky.",
    klipy: [],
    kroky: [
      "Klikněte na „Nahrát fotky“ a vyberte fotky v počítači (nebo je přetáhněte do oddílu Fotky).",
      "Klik na fotku ji zvětší — tam je „Nastavit jako hlavní“ a „Smazat fotku“.",
      "Pořadí změníte tlačítkem „Nastavit pořadí“ a přetažením fotek.",
    ],
    kde: "/produkty-workbench",
  },
  {
    klic: "produkt.popis",
    sekce: "produkt",
    nazev: "Popis výrobku",
    proc: "Text, který zákazník čte na stránce výrobku. Ukládá se sám, jakmile kliknete jinam.",
    klipy: [{ klic: "produkt.popis", popis: "Dopsat popis" }],
    kroky: [
      "Klikněte do pole Popis a pište.",
      "Klikněte kamkoli jinam — nahoře se krátce ukáže „Ukládám…“ a popis je uložený.",
    ],
  },
  {
    klic: "produkt.cena",
    sekce: "produkt",
    nazev: "Cena a sklad",
    proc:
      "Cena je v korunách, cena v eurech se dopočítá sama podle kurzu. Sklad je počet kusů, které máte doma — při prodeji se sám odečítá.",
    klipy: [{ klic: "produkt.cena", popis: "Změnit cenu a přidat kusy" }],
    kroky: [
      "V oddílu „Cena a sklad“ přepište cenu a stiskněte Enter.",
      "Tlačítkem + přidáte kus, − uberete. Do čísla jde i rovnou napsat nový stav.",
      "Víc velikostí nebo barev: „Přidat provedení“ — každé má vlastní cenu a sklad.",
    ],
  },
  {
    klic: "produkt.doprava",
    sekce: "produkt",
    nazev: "Doprava u výrobku",
    proc:
      "Podle velikosti zásilky se zákazníkovi spočítá poštovné. „Křehké“ pošle balík jako křehký, „Dobírka“ říká, jestli jde výrobek zaplatit při převzetí.",
    klipy: [{ klic: "produkt.doprava", popis: "Velikost zásilky, Křehké, Dobírka" }],
    kroky: [
      "Velikost zásilky: „Malé“ (vejde se do menší krabice), „Velké“, nebo „Poukaz“ (dárkový poukaz — nic se neposílá).",
      "Přepínač „Křehké“ zapněte u všeho, co se může rozbít.",
      "„Dobírka“ vypnutá = zákazník musí zaplatit předem.",
      "„Cena balení“ je balné za kus; prázdné = 0 Kč.",
    ],
  },
  {
    klic: "produkt.sleva",
    sekce: "produkt",
    nazev: "Sleva na výrobek",
    proc:
      "Zlevní jeden výrobek o zvolená procenta, od–do. V obchodě se ukáže přeškrtnutá původní cena. Na zlevněný výrobek pak neplatí slevové kódy.",
    klipy: [{ klic: "produkt.sleva", popis: "Nastavit slevu a vypnout ji" }],
    kroky: [
      "V oddílu „Cena a sklad“ u řádku „Sleva“ klikněte na „Přidat slevu“.",
      "Vyberte procenta (10, 20, 30, 50 %) nebo napište vlastní.",
      "Vyplňte „Od“ a případně „Do“ — bez data „Do“ platí, dokud ji nevypnete.",
      "Klikněte na „Nastavit slevu“. Přepínačem u řádku ji kdykoli vypnete, „Upravit“ ji změní.",
    ],
    pozor: "Když je výrobek ve výprodeji, sleva neplatí — výprodej má přednost.",
  },
  {
    klic: "produkt.vyprodej-vlastni",
    sekce: "produkt",
    nazev: "Výprodej jednoho výrobku",
    proc:
      "Jako sleva, ale může skončit sám, až se kusy prodají („Do vyprodání zásob“). Hodí se na poslední kusy. Výprodej má přednost před slevou i před kódy.",
    klipy: [{ klic: "produkt.vyprodej-vlastni", popis: "Výprodej do vyprodání zásob" }],
    kroky: [
      "U řádku „Výprodej tohoto produktu“ klikněte na „Nastavit výprodej“.",
      "Vyberte „Do vyprodání zásob“, nebo „Na čas“ (od–do).",
      "Vyberte slevu v procentech a uložte.",
    ],
  },
  {
    klic: "produkt.vyprodej-pridat",
    sekce: "produkt",
    nazev: "Přidat výrobek do výprodeje",
    proc:
      "Když už běží výprodej (třeba celé kolekce), přidáte do něj výrobek jedním klikem. Nový výprodej pro víc výrobků založíte ve Slevy → Výprodeje.",
    klipy: [],
    kroky: [
      "U řádku „Výprodej“ klikněte na „Přidat do výprodeje“.",
      "Vyberte výprodej ze seznamu, nebo založte nový.",
      "Z výprodeje výrobek vyřadíte u téhož řádku tlačítkem „Vyřadit“.",
    ],
  },
  {
    klic: "produkt.zarazeni",
    sekce: "produkt",
    nazev: "Zařazení výrobku (kolekce a kategorie)",
    proc:
      "Kde se výrobek v obchodě ukáže. Řádek = kolekce, vedle ní její kategorie. Výrobek může být ve víc kolekcích najednou — ukáže se v každé.",
    klipy: [{ klic: "produkt.zarazeni", popis: "Přidat do další kolekce a kategorie" }],
    kroky: [
      "Dole v oddílu „Zařazení“ klikněte na „+ Přidat do kolekce“ a vyberte kolekci.",
      "U nové kolekce klikněte na „+ Kategorie“ a vyberte kategorii.",
      "× u kolekce výrobek z ní vyndá, × u kategorie vyndá jen z kategorie.",
      "„nastavit jako hlavní“ — hlavní kolekce je ta první; jinak na ničem nezáleží.",
    ],
    kde: "/rozdeleni",
  },
  {
    klic: "produkt.prodej",
    sekce: "produkt",
    nazev: "Prodej — přepínače",
    proc:
      "Jak se výrobek prodává: na zakázku, s cenou po domluvě, i když není skladem, jako poškozený kus, nebo s označením mrazuvzdorný. Každý přepínač má vlastní otazník.",
    klipy: [
      { klic: "produkt.bez-skladu", popis: "Objednání bez kusů na skladu" },
      { klic: "produkt.poskozeny", popis: "Poškozený kus" },
    ],
    kroky: [
      "Přepínač zapnete kliknutím — změna se uloží hned.",
      "Na otazník u každého řádku se dozvíte, co přepínač dělá.",
    ],
  },
  {
    klic: "produkt.bez-skladu",
    sekce: "produkt",
    nazev: "Objednání bez kusů na skladu",
    proc:
      "Zákazník může koupit i výrobek, který zrovna není skladem — a uvidí vaši zprávu, např. že ho vyrobíte do 3 týdnů. Sklad pak jde do mínusu: uvidíte, kolik kusů dlužíte.",
    klipy: [{ klic: "produkt.bez-skladu", popis: "Zapnout a napsat zprávu pro zákazníka" }],
    kroky: [
      "Zapněte „Objednání bez kusů na skladu“.",
      "Do „Zpráva pro zákazníka“ napište, co zákazník uvidí (třeba „Vyrobíme pro vás do 3 týdnů.“).",
      "Klikněte jinam — uloží se.",
    ],
  },
  {
    klic: "produkt.poskozeny",
    sekce: "produkt",
    nazev: "Poškozený kus",
    proc:
      "Kus s vadou, který prodáváte levněji. V obchodě je mezi poškozenými kusy; po prodeji se sám skryje a po odeslání smaže. Popis vady napište do pole „Popis poškození“ u popisu.",
    klipy: [{ klic: "produkt.poskozeny", popis: "Označit kus jako poškozený" }],
    kroky: [
      "Zapněte „Poškozený kus“.",
      "U popisu vyplňte „Popis poškození“ — co je za vadu (zákazník ho uvidí).",
      "Nastavte nižší cenu nebo slevu.",
    ],
    pozor: "Poškozený kus nemá vlastní slevu ani výprodej — cenu snižte přímo.",
  },
  {
    klic: "produkt.na-zakazku",
    sekce: "produkt",
    nazev: "Výrobek na zakázku",
    proc:
      "Vyrábí se až po objednání: zákazník zaplatí zálohu (25 %), vy vyrobíte (14–42 dní) a před odesláním přijde doplatek. Podmínky jsou dole v oddílu „Zakázková výroba“.",
    klipy: [],
    kroky: [
      "Zapněte „Na zakázku“.",
      "Dole otevřete „Zakázková výroba“ a zkontrolujte zálohu a dobu výroby.",
      "Zákazník pak v pokladně napíše, co přesně chce (zadání), a vy ho v objednávce potvrdíte.",
    ],
  },
  {
    klic: "produkt.cena-po-domluve",
    sekce: "produkt",
    nazev: "Cena po domluvě",
    proc:
      "Když cenu neznáte předem (hlavně zakázky). Zákazník objedná za 0 Kč, vy mu cenu pošlete z objednávky a on ji zaplatí odkazem z e-mailu. Výrobek se tím stane zakázkou.",
    klipy: [],
    kroky: [
      "Zapněte „Cena po domluvě“ — cenu vyplňovat nemusíte (0 Kč nevadí).",
      "Po objednání v detailu objednávky vyplňte cenu a pošlete ji zákazníkovi.",
    ],
  },
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
