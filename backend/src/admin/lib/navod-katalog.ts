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
  /* ————————————————— Začínáme ————————————————— */
  {
    klic: "zacatek.prehled",
    sekce: "zacatek",
    nazev: "Přehled — co mě dnes čeká",
    proc:
      "První stránka po přihlášení. Nahoře červeně, co brání nákupu; „Čeká na vás“ ukazuje, co je potřeba vyřídit (nové objednávky, zakázky, reklamace). Níž tržby a objednávky.",
    klipy: [{ klic: "zacatek.prehled", popis: "Přehled a kartičky „Čeká na vás“" }],
    kroky: [
      "Po přihlášení se otevře Přehled (v menu úplně nahoře).",
      "Klik na kartičku v „Čeká na vás“ vás vezme rovnou k věci.",
      "„Jak se obchodu daří“ přepnete na 7 dní, 30 dní, 3 měsíce nebo rok.",
    ],
    kde: "/prehled",
  },
  {
    klic: "zacatek.orientace",
    sekce: "zacatek",
    nazev: "Jak se v adminu pohybovat",
    proc:
      "Vlevo je menu, nahoře vlevo šipky Zpět a Vpřed (jako v prohlížeči). „Hledat“ (Ctrl+K) najde výrobek, objednávku i zákazníka podle kousku názvu nebo čísla.",
    klipy: [{ klic: "zacatek.orientace", popis: "Menu, šipka Zpět a hledání" }],
    kroky: [
      "V menu vlevo klikněte, kam chcete.",
      "Šipkou ↶ nahoře vlevo se vrátíte o krok zpět, ↷ vpřed.",
      "„Hledat“ nahoře v menu (nebo Ctrl+K) — napište kus názvu a vyberte.",
    ],
  },
  {
    klic: "zacatek.navod",
    sekce: "zacatek",
    nazev: "Jak používat Návod",
    proc:
      "U nadpisů a nastavení je otazník „?“. Najeďte na něj myší (nebo klikněte) — otevře se okénko s krátkým videem, jak se to dělá. Klik na video ho zvětší. Všechny návody najdete v menu „Návod“ úplně dole.",
    klipy: [{ klic: "zacatek.navod", popis: "Otazník a stránka Návod" }],
    kroky: [
      "Najeďte myší na „?“ — okénko se otevře samo; kliknutím ho připnete.",
      "„Celý návod s kroky →“ otevře stránku Návod.",
      "Na stránce Návod jde hledat — např. „sleva“, „štítek“, „poukaz“.",
    ],
    kde: "/navod",
  },
  /* ————————————————— Kolekce a kategorie: zakládání ————————————————— */
  {
    klic: "kategorie.nova",
    sekce: "zarazeni",
    nazev: "Nová kolekce a kategorie",
    proc:
      "Kolekce je velká skupina v menu obchodu (např. Do zahrady a na fasádu), kategorie je její podskupina (např. Pítka a krmítka). V obchodě se ukážou, jakmile v nich bude zveřejněný výrobek.",
    klipy: [{ klic: "kategorie.nova", popis: "Založit kolekci a kategorii" }],
    kroky: [
      "Kolekce a kategorie → vlevo dole „Nová kolekce…“ → název → +.",
      "Uprostřed „Nová kategorie…“ → název, vyberte, pod kterou kolekci patří → „Založit kategorii“.",
      "Pořadí v menu obchodu změníte přetažením za ⠿.",
      "Přejmenovat, skrýt nebo smazat jde přes „…“ u kolekce či kategorie.",
    ],
    kde: "/rozdeleni",
  },
  /* ————————————————— Zákazníci a statistiky ————————————————— */
  {
    klic: "zakaznici.prehled",
    sekce: "zakaznici",
    nazev: "Zákazníci",
    proc:
      "Kdo u vás nakupuje: s účtem i bez registrace, kdo dluží doplatek, kdo vrací a kdo odebírá novinky. Klik na zákazníka ukáže jeho objednávky.",
    klipy: [{ klic: "zakaznici.prehled", popis: "Záložky zákazníků" }],
    kroky: [
      "Zákazníci → záložky nahoře (Uživatelé, Neregistrovaní, Čeká na doplatek, Vrací se, Newsletter).",
      "„Kód pro stálé zákazníky“ připraví slevový kód, který jim pošlete.",
    ],
    kde: "/zakaznici-workbench",
  },
  {
    klic: "statistiky.prehled",
    sekce: "zakaznici",
    nazev: "Statistiky",
    proc: "Tržby, objednávky, nejprodávanější výrobky, zákazníci, sklad a slevy — každé ve své záložce.",
    klipy: [{ klic: "statistiky.prehled", popis: "Záložky statistik" }],
    kroky: ["Statistiky → přepínejte záložky nahoře."],
    kde: "/statistiky-workbench",
  },
  /* ————————————————— E-maily a newsletter ————————————————— */
  {
    klic: "newsletter.napsat",
    sekce: "komunikace",
    nazev: "Poslat newsletter",
    proc:
      "Zprávu poskládáte z bloků (nadpis, odstavec, obrázek, výrobek, sleva…) a vpravo hned vidíte, jak dorazí. Nejdřív si pošlete test na svůj e-mail, pak odešlete všem potvrzeným odběratelům. Rozepsaná zpráva se ukládá sama.",
    klipy: [{ klic: "newsletter.napsat", popis: "Napsat zprávu z bloků" }],
    kroky: [
      "Newsletter → „Napsat“: vyplňte předmět.",
      "Bloky pod sebou upravte; další přidáte tlačítky „+ Nadpis“, „+ Odstavec“, „+ Produkt“…",
      "„Poslat test na můj e-mail“ — zkontrolujte ve své schránce.",
      "„Odeslat kampaň“ — odejde všem, kdo odběr potvrdili.",
    ],
    kde: "/newsletter",
  },
  {
    klic: "emaily.prehled",
    sekce: "komunikace",
    nazev: "Co zákazníkům chodí e-mailem",
    proc:
      "Všechny e-maily, které obchod posílá sám (potvrzení objednávky, odeslání, faktura, poukaz, kurzy…). Vlevo seznam, vpravo náhled, jak e-mail vypadá.",
    klipy: [{ klic: "emaily.prehled", popis: "Seznam a náhled e-mailů" }],
    kroky: ["Emaily → klikněte na e-mail vlevo, vpravo uvidíte náhled."],
    kde: "/emaily",
  },
  /* ————————————————— Nastavení obchodu ————————————————— */
  {
    klic: "nastaveni.dovolena",
    sekce: "nastaveni",
    nazev: "Dovolená a oznámení",
    proc:
      "Když jedete pryč, zapněte „Mám dovolenou“ — nakupovat jde dál, ale zákazníci nahoře na webu uvidí, kdy se vrátíte. Ode dne návratu se upozornění samo skryje. „Oznámení“ je pro trhy, výstavy, nový výpal.",
    klipy: [{ klic: "nastaveni.dovolena", popis: "Zapnout dovolenou" }],
    kroky: [
      "Nastavení obchodu → „Dovolená a oznámení“.",
      "Zapněte „Mám dovolenou“, vyplňte datum návratu a vzkaz.",
      "„Uložit“.",
    ],
    kde: "/dovolena-oznameni",
  },
  {
    klic: "nastaveni.doprava",
    sekce: "nastaveni",
    nazev: "Ceny dopravy a dobírky",
    proc: "Kolik stojí poštovné (malé / velké / křehké, ČR / Slovensko) a příplatek za dobírku.",
    klipy: [{ klic: "nastaveni.doprava", popis: "Doprava a platba" }],
    kroky: ["Nastavení obchodu → „Doprava a platba“ → přepište cenu → „Uložit“."],
    kde: "/doprava-platba",
  },
  {
    klic: "nastaveni.pravni",
    sekce: "nastaveni",
    nazev: "Právní údaje",
    proc:
      "Sídlo, IČO, DPH, lhůty a další údaje, které se samy propisují do obchodních podmínek, faktur a e-mailů. Texty obchodních podmínek jsou ve Studiu (menu Web).",
    klipy: [{ klic: "nastaveni.pravni", popis: "Právní věci a texty" }],
    kroky: ["Právní věci a texty → „Právní údaje“ → upravte → „Uložit“."],
    kde: "/pravni-udaje",
  },
  /* ————————————————— Objednávky ————————————————— */
  {
    klic: "objednavky.seznam",
    sekce: "objednavky",
    nazev: "Kde najdu objednávky",
    proc:
      "Záložky nahoře třídí objednávky podle toho, kde jsou: Nové (nikdo je ještě nezačal), Připravujeme, K odeslání, Na poštu, Problém s platbou, Čeká na doplatek. Klik na číslo otevře detail.",
    klipy: [{ klic: "objednavky.seznam", popis: "Záložky a otevření objednávky" }],
    kroky: [
      "V menu klikněte na „Objednávky“.",
      "Začněte záložkou „Nové“ — to jsou objednávky, které čekají na vás.",
      "Klik na řádek (číslo #) otevře detail objednávky.",
      "Přepínač „Vše · Výrobky · Zakázky | Poptávky“ odfiltruje druh objednávky.",
    ],
    kde: "/objednavky",
  },
  {
    klic: "objednavky.postup",
    sekce: "objednavky",
    nazev: "Vyřídit objednávku krok za krokem",
    proc:
      "V detailu objednávky je nahoře „Postup objednávky“ — kolečka ukazují, kde objednávka je, a velké tlačítko říká, co udělat dál. Každý krok pošle zákazníkovi e-mail (napsáno pod tlačítkem). 5 vteřin po kliknutí jde krok ještě vrátit.",
    klipy: [
      { klic: "objednavky.postup", popis: "Na adresu — připravit, zabalit, odeslat" },
      { klic: "objednavky.odber", popis: "Osobní odběr — připraveno, vyzvednuto" },
    ],
    kroky: [
      "Otevřete objednávku a klikněte na „Začít připravovat“.",
      "Zabalíte → „Zabaleno, připraveno k odeslání“.",
      "Vytiskněte štítek v oddílu „Štítek České pošty“ a balík odneste na poštu.",
      "„Označit jako odeslané“ — zákazník dostane e-mail s číslem zásilky. Když balík pošta převezme, zapíše se to i samo.",
      "Osobní odběr: „Připraveno k vyzvednutí“ → po předání „Vyzvednuto a zaplaceno“.",
    ],
    pozor: "Spletete se? Hned po kliknutí je dole „Vrátit zpět“ (5 vteřin).",
  },
  {
    klic: "objednavky.zpozdeni",
    sekce: "objednavky",
    nazev: "Objednávka se zdrží",
    proc:
      "Když nestihnete odeslat, pošlete zákazníkovi omluvu s novým termínem. U objednávky pak svítí štítek „Nový termín“.",
    klipy: [{ klic: "objednavky.zpozdeni", popis: "Oznámit zpoždění" }],
    kroky: [
      "V detailu objednávky vpravo otevřete „Zpoždění“ → „Oznámit zpoždění“.",
      "Zaškrtněte výrobky, které se zdrží, a vyberte nový termín.",
      "Napište důvod (nepovinné — zákazník ho uvidí).",
      "Klikněte na „Poslat zákazníkovi omluvu“.",
    ],
  },
  /* ————————————————— Zakázky ————————————————— */
  {
    klic: "zakazky.postup",
    sekce: "zakazky",
    nazev: "Vyřídit zakázku",
    proc:
      "Zakázka jde jinou cestou než běžná objednávka: zákazník zaplatil zálohu a napsal zadání. Vy zadání potvrdíte, vyrobíte, pošlete výzvu k doplacení a po zaplacení odešlete. Vše je v detailu objednávky — vlevo „Postup objednávky“, vpravo „Výroba na zakázku“ (zadání, platby, poznámky).",
    klipy: [
      { klic: "zakazky.postup", popis: "Potvrdit zadání → výroba → hotovo" },
      { klic: "zakazky.priplatek", popis: "Příplatek k zakázce" },
      { klic: "zakazky.konverzace", popis: "Napsat zákazníkovi" },
      { klic: "zakazky.poznamka", popis: "Interní poznámka" },
    ],
    kroky: [
      "Přečtěte si zadání vpravo („Zadání od zákazníka“). Nejasnosti doptejte přes „Konverzace se zákazníkem“.",
      "„Potvrdit zadání“ → zákazník dostane e-mail, že je zakázka přijatá.",
      "„Začít výrobu“, a když je hotovo, „Výroba dokončena“.",
      "„Poslat výzvu k doplacení“ — zákazník dostane odkaz k zaplacení zbytku. Odeslání se odemkne až po zaplacení.",
      "Pak jako běžná objednávka: zabalit, štítek, odeslat.",
    ],
    pozor: "Vyjde zakázka dráž? „Přidat příplatek“ — přičte se k doplatku. Interní poznámku vidíte jen vy.",
    kde: "/objednavky?zalozka=zakazky",
  },
  /* ————————————————— Reklamace a vrácení ————————————————— */
  {
    klic: "reklamace.vyrizeni",
    sekce: "reklamace",
    nazev: "Vyřídit reklamaci nebo vrácení",
    proc:
      "Každá žádost jde stejnou cestou: rozhodnout (schválit / zamítnout) → zboží zpět → vrátit peníze → vyřízeno. Peníze se NIKDY nevrací samy — jen tlačítkem „Vrátit … Kč“ v košíku vrácení. Každý krok pošle zákazníkovi e-mail. Lhůta na vyřízení je 30 dní (svítí u žádosti).",
    klipy: [
      { klic: "reklamace.vyrizeni", popis: "Schválit, přijmout zboží, vrátit peníze" },
      { klic: "reklamace.zamitnout", popis: "Zamítnout s odůvodněním" },
    ],
    kroky: [
      "Reklamace a vrácení → záložka „Nové“ → klik na žádost.",
      "Přečtěte důvod a fotky. Oprávněná: „Schválit“, vyberte způsob (vrácení peněz / výměna) → „Schválit a poslat e-mail“.",
      "Až zboží dorazí: „Zboží přijato“ → potvrdit.",
      "V košíku vrácení zaškrtněte, co vracíte (poštovné se u reklamace nevrací) → „Vrátit … Kč“. Kartou odejdou peníze hned, u dobírky převedete na účet z karty „Vrácení převodem“.",
      "Nakonec „Vyřízeno“ → „Vyřízeno a poslat potvrzení“.",
      "Neoprávněná: „Zamítnout“, napište odůvodnění (povinné) → „Zamítnout a poslat e-mail“.",
    ],
    pozor: "Hlídejte lhůtu — červený štítek „Po lhůtě“ znamená, že 30 dní uplynulo.",
    kde: "/reklamace",
  },
  /* ————————————————— Sklad ————————————————— */
  {
    klic: "sklad.naskladnit",
    sekce: "sklad",
    nazev: "Naskladnit po výpalu",
    proc:
      "Když vyjde várka z pece, zapíšete přírůstky u všech výrobků najednou a uložíte jedním tlačítkem.",
    klipy: [{ klic: "sklad.naskladnit", popis: "Přidat kusy víc výrobkům najednou" }],
    kroky: [
      "Sklad → „Naskladnit po výpalu“.",
      "Výrobek najdete hledáním; do pole „+ ks“ napište, kolik kusů přibylo.",
      "Dole klikněte na „Naskladnit (…)“ — uloží se všechno najednou.",
    ],
    kde: "/sklad-workbench",
  },
  {
    klic: "sklad.prehled",
    sekce: "sklad",
    nazev: "Co dochází a co je vyprodané",
    proc:
      "Zásoby ukazují, kolik kusů máte. Nahoře je to, o co je zájem (v košících, v oblíbených). Záložky „Dochází“ a „Vyprodáno“ hlídají, co dodělat.",
    klipy: [{ klic: "sklad.prehled", popis: "Záložky a rychlá úprava počtu" }],
    kroky: [
      "Sklad → záložka „Dochází“ nebo „Vyprodáno“.",
      "+ / − u řádku změní počet hned.",
    ],
    kde: "/sklad-workbench",
  },
  /* ————————————————— Kurzy ————————————————— */
  {
    klic: "kurzy.novy-termin",
    sekce: "kurzy",
    nazev: "Vypsat nový termín kurzu",
    proc:
      "Termín se hned ukáže na webu v Kurzech a lidé se můžou přihlásit. Vybrat jde víc dní najednou — z každého vznikne samostatný termín.",
    klipy: [{ klic: "kurzy.novy-termin", popis: "Nový termín ve dvou krocích" }],
    kroky: [
      "Kurzy → „Nový termín“.",
      "Napište název a místo, v kalendáři klikněte na dny, vyplňte čas, délku a kapacitu.",
      "„Dál — ceny“: cena za dospělého, případně za dítě a skupinu.",
      "„Vytvořit termín“.",
    ],
    kde: "/kurzy-sprava",
  },
  /* ————————————————— Poukazy ————————————————— */
  {
    klic: "poukazy.novy",
    sekce: "poukazy",
    nazev: "Vystavit dárkový poukaz ručně",
    proc:
      "Když zákazník poukaz koupí v dílně, po telefonu nebo převodem. Kód se vytvoří sám; vytištěný poukaz si stáhnete jako PDF, elektronický odejde e-mailem. Poukazy koupené na webu se tu objeví samy.",
    klipy: [{ klic: "poukazy.novy", popis: "Nový poukaz" }],
    kroky: [
      "Poukazy → „Nový poukaz“.",
      "Vyberte vytištěný / elektronický a hodnotu.",
      "Jméno obdarovaného a věnování jsou nepovinné.",
      "Vyplňte kupujícího a platbu → „Vystavit poukaz“.",
    ],
    kde: "/poukazy",
  },
  /* ————————————————— Slevy ————————————————— */
  {
    klic: "slevy.vyprodej",
    sekce: "slevy",
    nazev: "Výprodej pro víc výrobků",
    proc:
      "Zlevní celou kolekci, kategorii nebo vybrané kusy. „Na čas“ platí od–do, „Do vyprodání zásob“ zlevní jen kusy skladem a skončí sám, až se prodá poslední. Výprodej má přednost před slevou výrobku i před slevovými kódy.",
    klipy: [{ klic: "slevy.vyprodej-novy", popis: "Nový výprodej ve třech krocích" }],
    kroky: [
      "Slevy → záložka „Výprodeje“ → „Nový výprodej“.",
      "1. Typ: „Na čas“, nebo „Do vyprodání zásob“ → „Další“.",
      "2. Výrobky: zaškrtněte kolekci, kategorii nebo jednotlivé výrobky → „Další“.",
      "3. Sleva: procenta; dole vidíte, kolik výrobků se zlevní → „Spustit výprodej“.",
    ],
    kde: "/slevy-workbench",
  },
  {
    klic: "slevy.kod",
    sekce: "slevy",
    nazev: "Slevový kód",
    proc:
      "Kód, který zákazník napíše v pokladně (např. JARO10). Platí na celou objednávku nebo dává dopravu zdarma; na zlevněné výrobky a výprodeje neplatí.",
    klipy: [{ klic: "slevy.kod", popis: "Nový slevový kód" }],
    kroky: [
      "Slevy → záložka „Akce a kódy“ → „Nová sleva“.",
      "Napište kód, vyberte, co sleva dělá, a kolik.",
      "Uložte — kód platí hned.",
    ],
    kde: "/slevy-workbench",
  },
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
      "„…“ na konci řádku otevře nastavení výrobku jako na detailu: nahoře Skrýt/Zobrazit v obchodě, pak Cena a sklad, Doprava, Prodej (typ výrobku, slevové kódy), Materiál a rozměry; dole Archivovat a Smazat. Ceny a provedení nebo Povolené dopravy se otevřou vedle nabídky.",
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
