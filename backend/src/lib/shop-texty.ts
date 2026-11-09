/**
 * Texty obchodu — věty, které zákazník čte u výrobku, v košíku, v pokladně
 * a na hotové objednávce.
 *
 * ## Proč tohle vzniklo
 *
 * „Tyhle informace je třeba mít všechny v tom adminu, aby se to dalo
 * upravit." (Matěj za paní Polanskou, 9. 11. 2026.) Spouštěčem byla věta
 * o zakázkové výrobě a lhůta 42 dnů, která je na plastiky krátká: obojí
 * stálo napevno v kódu obchodu, takže změna znamenala nasazení.
 *
 * Teď je to přesně naopak než u obsahu webu: tyhle věty NEJSOU ve Studiu.
 * Mluví o tom, jak obchod funguje — kdy se platí, jak dlouho se vyrábí, čím
 * se posílá — a čte je i backend (e-maily). Nesmí tedy záviset na tom, jestli
 * Studio běží. Je to stejná úvaha jako u Právních údajů, a proto to bydlí
 * na stejném místě: `store.metadata.merchant_settings.shop_texts`.
 *
 * ## Vypínač u každé věty
 *
 * Vedle textu stojí přepínač (`shop_texts_off`). Vypnutá věta se zákazníkovi
 * neukáže, ale znění zůstane uložené — zapnutím se vrátí, nic se nepřepisuje.
 * Vypnuté věty vrací `GET /store/texty` jako prázdné, takže obchod nemusí
 * o vypínači vědět: prázdná věta se prostě nevykreslí.
 *
 * ## Právní věty
 *
 * Některé věty tu jsou, i když musí souhlasit s obchodními podmínkami —
 * poučení o 14denní lhůtě u zakázky nebo o nevratné záloze. Jsou poznané
 * (`pravni: true`), formulář u nich varuje a radí měnit je společně
 * s podmínkami. Vypnout je jde, ale pak je nemá kde zákazník přečíst před
 * objednávkou, což je přesně to, co § 1820 OZ chce.
 *
 * Co tu NENÍ vůbec: zaškrtnutí v pokladně (Z10) a předsmluvní informace.
 * Ta znění se otiskují do PDF Potvrzení zakázky a do objednávky, takže by
 * změna v políčku rozešla dokument se smlouvou.
 *
 * ## Bez importů
 *
 * Čte to administrace (Vite bundle v prohlížeči) i server. Import čehokoli
 * z frameworku by do adminu zatáhl celý serverový strom — stejný důvod jako
 * u `legal-facts.ts`.
 */

/** Všechny klíče v pořadí, v jakém je formulář ukazuje. */
export const SHOP_TEXT_KEYS = [
  /* Stránka výrobku */
  "produkt.cekani",
  "produkt.cena_po_domluve",
  "produkt.recenze_pravidla",
  /* Stránka výrobku — panel „Vyrábí se na zakázku" */
  "zakazka.panel_nadpis",
  "zakazka.panel_lhuta",
  "zakazka.panel_lhuta_rozmezi",
  "zakazka.panel_zaloha",
  "zakazka.panel_zaloha_po_domluve",
  "zakazka.panel_kosik",
  "zakazka.panel_bez_vraceni",
  /* Stránka výrobku — štítek pod cenou */
  "zakazka.stitek",
  "zakazka.stitek_zaloha",
  "zakazka.stitek_zaloha_po_domluve",
  "zakazka.stitek_vyroba",
  /* Stránka výrobku — „Jak zakázka probíhá" */
  "zakazka.kroky_nadpis",
  "zakazka.krok_zahajeni_nazev",
  "zakazka.krok_zahajeni",
  "zakazka.krok_dokonceni_nazev",
  "zakazka.krok_dokonceni",
  "zakazka.krok_dokonceni_bez_lhuty",
  "zakazka.krok_schvaleni_nazev",
  "zakazka.krok_schvaleni",
  "zakazka.krok_odeslani_nazev",
  "zakazka.krok_odeslani",
  "zakazka.kroky_zruseni",
  /* Stránka výrobku — bezpečné používání */
  "bezpecnost.nadpis",
  "bezpecnost.kotveni",
  "bezpecnost.mraz",
  "bezpecnost.strepy",
  /* Košík */
  "kosik.cena_po_domluve",
  "kosik.poukaz_vse",
  "kosik.poukaz_nastavit",
  "slevy.jeden_kod",
  "slevy.poukaz",
  "slevy.zlevnene",
  /* Pokladna */
  "pokladna.cena_po_domluve_nula",
  "pokladna.doprava_krehke",
  "pokladna.doprava_zakazka",
  "pokladna.doprava_cena_po_domluve",
  "pokladna.platba_uvod",
  "pokladna.platba_zaloha_kartou",
  "pokladna.platba_na_miste",
  /* Hotová objednávka */
  "objednavka.potvrzeni",
  "objednavka.poskozeny_obal",
] as const

export type ShopTextKey = (typeof SHOP_TEXT_KEYS)[number]

/** Hodnoty všech textů. Prázdný řetězec = větu neukazovat. */
export type ShopTextValues = Record<ShopTextKey, string>

/**
 * Co je uložené v nastavení: jen klíče, které se někdy měnily.
 * Chybějící klíč = výchozí znění.
 */
export type StoredShopTexts = Partial<Record<ShopTextKey, string>>

/** Které věty jsou vypnuté. Chybějící klíč = zapnutá. */
export type StoredShopTextsOff = Partial<Record<ShopTextKey, boolean>>

/** Skupiny formuláře v pořadí, v jakém je stránka ukazuje. */
export const SHOP_TEXT_GROUPS = [
  "Stránka výrobku",
  "Zakázka — panel u ceny",
  "Zakázka — štítek pod cenou",
  "Zakázka — jak probíhá",
  "Bezpečné používání",
  "Košík",
  "Slevy a poukazy",
  "Pokladna",
  "Hotová objednávka",
] as const

export type ShopTextGroup = (typeof SHOP_TEXT_GROUPS)[number]

export type ShopTextMeta = {
  /** Název pole ve formuláři. */
  label: string
  /** Co to je a kdy přesně to zákazník uvidí. */
  help: string
  group: ShopTextGroup
  /** Víceřádkové pole ve formuláři. */
  multiline: boolean
  maxLength: number
  /**
   * Zástupné značky, které se ve větě nahradí skutečnou hodnotou. Formulář je
   * vypíše a u povinných pohlídá, že nezmizely — věta o lhůtě bez `{{dny}}`
   * by mlčela o tom, kvůli čemu se text mění.
   */
  znacky?: { znacka: string; popis: string; povinna: boolean }[]
  /** Adresa v obchodě, kde se text ukáže — formulář z ní udělá odkaz. */
  nahled?: string
  /**
   * Věta, která musí souhlasit s obchodními podmínkami. Formulář u ní varuje;
   * měnit ji samotnou znamená rozejít web s podmínkami.
   */
  pravni?: boolean
}

export const SHOP_TEXT_META: Record<ShopTextKey, ShopTextMeta> = {
  "produkt.cekani": {
    label: "Není skladem — jak dlouho se čeká",
    help:
      "Věta pod dostupností u výrobku, který není skladem, ale jde objednat. Když má kus vlastní „Zprávu pro zákazníka“ na svém detailu, platí ta jeho.",
    group: "Stránka výrobku",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/store",
  },
  "produkt.cena_po_domluve": {
    label: "Cena po domluvě — věta pod cenou",
    help:
      "Ukáže se u výrobku, který má cenu po domluvě. Musí být jasné, že objednávka je závazná, ale teď se neplatí nic.",
    group: "Stránka výrobku",
    multiline: true,
    maxLength: 400,
  },

  "produkt.recenze_pravidla": {
    label: "Pravidla recenzí",
    help:
      "Ukáže se pod recenzemi u výrobku, ve formuláři na novou recenzi a v účtu. Vysvětluje, kdo smí psát a co znamená „Ověřený nákup“.",
    group: "Stránka výrobku",
    multiline: true,
    maxLength: 600,
    pravni: true,
  },

  "zakazka.panel_nadpis": {
    label: "Nadpis panelu",
    help: "Záhlaví rámečku u ceny zakázkového výrobku.",
    group: "Zakázka — panel u ceny",
    multiline: false,
    maxLength: 80,
  },
  "zakazka.panel_lhuta": {
    label: "Lhůta (když je v profilu vyplněná)",
    help:
      "První věta panelu. Číslo dnů se bere z výrobního profilu toho kusu, takže jedno znění platí pro hrnek i pro plastiku.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 300,
    znacky: [
      { znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech z profilu", povinna: true },
      { znacka: "{{obvykle}}", popis: "rozpětí v závorce, např. „ (obvykle 14–42 dní)“; bez rozpětí zmizí", povinna: false },
    ],
  },
  "zakazka.panel_lhuta_rozmezi": {
    label: "Lhůta (jen rozpětí, bez nejdelší)",
    help: "Platí u zakázky, která má v profilu jen rozpětí, ne nejdelší lhůtu.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 300,
    znacky: [{ znacka: "{{rozmezi}}", popis: "rozpětí z profilu, např. „14–42 dní“", povinna: true }],
  },
  "zakazka.panel_zaloha": {
    label: "Záloha v procentech",
    help:
      "Platí, když je cena známá. Procento je z profilu výroby; částka se dopočítá z ceny provedení a bez ní se vynechá.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 400,
    znacky: [
      { znacka: "{{procento}}", popis: "záloha v procentech z profilu", povinna: true },
      { znacka: "{{castka}}", popis: "záloha v korunách, např. „ — 1 075 Kč“; bez ceny zmizí", povinna: false },
    ],
  },
  "zakazka.panel_zaloha_po_domluve": {
    label: "Záloha u ceny po domluvě",
    help:
      "Platí u kusu s cenou po domluvě — procento ani částka tu nedávají smysl, počítaly by se z nuly.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 500,
  },
  "zakazka.panel_kosik": {
    label: "Kde se zadává popis a fotky",
    help: "Věta, která zákazníkovi řekne, že zadání píše až v košíku, ne tady.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 300,
  },
  "zakazka.panel_bez_vraceni": {
    label: "Poučení o 14denní lhůtě",
    help:
      "Zákazník to musí vědět PŘED objednávkou (§ 1820 odst. 1 písm. j) OZ) a v pokladně to ještě potvrdí zaškrtnutím. Totéž znění se krátí do štítku pod cenou.",
    group: "Zakázka — panel u ceny",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },

  "zakazka.stitek": {
    label: "Štítek pod cenou — skladba",
    help:
      "Jednořádkový štítek pod cenou. Části oddělené tečkou se samy vynechají, když nemají co říct (třeba bez vyplněné lhůty).",
    group: "Zakázka — štítek pod cenou",
    multiline: true,
    maxLength: 300,
    znacky: [
      { znacka: "{{zaloha}}", popis: "část o záloze — skládá se z polí níž", povinna: false },
      { znacka: "{{vyroba}}", popis: "část o lhůtě — skládá se z pole níž", povinna: false },
    ],
    pravni: true,
  },
  "zakazka.stitek_zaloha": {
    label: "Štítek — část o záloze",
    help: "Dosadí se za {{zaloha}}, když je procento zálohy známé.",
    group: "Zakázka — štítek pod cenou",
    multiline: false,
    maxLength: 100,
    znacky: [{ znacka: "{{procento}}", popis: "záloha v procentech", povinna: true }],
  },
  "zakazka.stitek_zaloha_po_domluve": {
    label: "Štítek — záloha u ceny po domluvě",
    help: "Dosadí se za {{zaloha}} u kusu s cenou po domluvě.",
    group: "Zakázka — štítek pod cenou",
    multiline: false,
    maxLength: 100,
  },
  "zakazka.stitek_vyroba": {
    label: "Štítek — část o lhůtě",
    help: "Dosadí se za {{vyroba}}, když je v profilu nejdelší lhůta.",
    group: "Zakázka — štítek pod cenou",
    multiline: false,
    maxLength: 100,
    znacky: [{ znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech", povinna: true }],
  },

  "zakazka.kroky_nadpis": {
    label: "Nadpis bloku",
    help: "Záhlaví čtyř kroků pod tlačítkem u zakázkového výrobku.",
    group: "Zakázka — jak probíhá",
    multiline: false,
    maxLength: 80,
  },
  "zakazka.krok_zahajeni_nazev": {
    label: "Krok 1 — název",
    help: "Tučné slovo na začátku prvního kroku.",
    group: "Zakázka — jak probíhá",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_zahajeni": {
    label: "Krok 1 — text",
    help:
      "Kdy se začíná vyrábět. Totéž čte zákazník i v PDF Potvrzení zakázky, bod 05.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_dokonceni_nazev": {
    label: "Krok 2 — název",
    help: "Tučné slovo na začátku druhého kroku.",
    group: "Zakázka — jak probíhá",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_dokonceni": {
    label: "Krok 2 — text (se lhůtou)",
    help:
      "Platí u zakázky, která má ve výrobním profilu vyplněnou nejdelší lhůtu. Právě tady se mění ta lhůta, co je na plastiky krátká — číslo se bere z profilu, věta jen říká, jak se podá.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 600,
    znacky: [{ znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech z profilu výroby", povinna: true }],
  },
  "zakazka.krok_dokonceni_bez_lhuty": {
    label: "Krok 2 — text (bez lhůty)",
    help:
      "Platí u zakázky, která lhůtu v profilu vyplněnou nemá. Nesmí slibovat termín — jen říct, kde ho zákazník najde.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_schvaleni_nazev": {
    label: "Krok 3 — název",
    help: "Tučné slovo na začátku třetího kroku.",
    group: "Zakázka — jak probíhá",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_schvaleni": {
    label: "Krok 3 — text",
    help: "Kdy posíláte fotku hotového tvaru a kolik času má zákazník na odpověď.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_odeslani_nazev": {
    label: "Krok 4 — název",
    help: "Tučné slovo na začátku čtvrtého kroku.",
    group: "Zakázka — jak probíhá",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_odeslani": {
    label: "Krok 4 — text",
    help: "Co se stane po doplatku — odeslání, nebo připravení k vyzvednutí.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.kroky_zruseni": {
    label: "Zrušení zakázky (věta pod kroky)",
    help:
      "Poslední odstavec bloku. Odkaz na obchodní podmínky se připojí sám za touhle větou.",
    group: "Zakázka — jak probíhá",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },

  "bezpecnost.nadpis": {
    label: "Nadpis bloku",
    help: "Záhlaví bezpečnostního upozornění u výrobku.",
    group: "Bezpečné používání",
    multiline: false,
    maxLength: 80,
  },
  "bezpecnost.kotveni": {
    label: "Kotvení na zeď",
    help:
      "Ukáže se u kusů, které se věší — plastiky na zeď, domovní čísla, schránky, zvonková tlačítka.",
    group: "Bezpečné používání",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },
  "bezpecnost.mraz": {
    label: "Mráz v nádobě",
    help: "Ukáže se u pítek, krmítek a květináčů — všeho, kde může zamrznout voda.",
    group: "Bezpečné používání",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },
  "bezpecnost.strepy": {
    label: "Křehkost a střepy",
    help: "Ukáže se u každého výrobku — keramika je křehká vždycky.",
    group: "Bezpečné používání",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },

  "kosik.cena_po_domluve": {
    label: "Cena po domluvě — věta v souhrnu",
    help:
      "Ukáže se v souhrnu košíku i pokladny, když je v košíku kus s cenou po domluvě. O poštovném tu schválně nic není: kdy se platí, závisí na zbytku košíku.",
    group: "Košík",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/cart",
  },
  "kosik.poukaz_vse": {
    label: "Celou objednávku hradí poukaz",
    help: "Věta u tlačítka, když dárkový poukaz pokryl celou částku a nic se nedoplácí.",
    group: "Košík",
    multiline: true,
    maxLength: 400,
  },

  "kosik.poukaz_nastavit": {
    label: "Poukaz ještě není nastavený",
    help:
      "Ukáže se v košíku, když je v něm dárkový poukaz bez vybrané hodnoty nebo podoby. Do pokladny to tak jako tak nepustí.",
    group: "Košík",
    multiline: true,
    maxLength: 300,
  },

  "slevy.jeden_kod": {
    label: "Jen jeden slevový kód",
    help:
      "Ukáže se u políčka na slevový kód, když už nějaký kód na objednávce je. Vysvětluje, že se kódy nesčítají, ale poukazy ano.",
    group: "Slevy a poukazy",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/cart",
  },
  "slevy.poukaz": {
    label: "Z čeho se odečítá poukaz",
    help: "Ukáže se, když je na objednávce dárkový poukaz.",
    group: "Slevy a poukazy",
    multiline: true,
    maxLength: 400,
  },
  "slevy.zlevnene": {
    label: "Zlevněné kusy a slevové kódy",
    help: "Ukáže se, když je v košíku kus v akci.",
    group: "Slevy a poukazy",
    multiline: true,
    maxLength: 400,
  },

  "pokladna.cena_po_domluve_nula": {
    label: "Teď se neplatí nic",
    help:
      "Věta u odesílacího tlačítka v pokladně, když je k úhradě nula, protože v košíku je jen cena po domluvě.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
    nahled: "/cz/checkout",
  },
  "pokladna.doprava_krehke": {
    label: "Doručení — křehký kus",
    help:
      "Vysvětlení v kroku Doručení, proč jsou na výběr jen křehký balík a osobní odběr.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_zakazka": {
    label: "Doručení — zakázková výroba",
    help: "Totéž u zakázkové výroby.",
    group: "Pokladna",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_cena_po_domluve": {
    label: "Doručení — cena po domluvě",
    help:
      "Totéž u kusu s cenou po domluvě. Navíc musí být jasné, že dopravu si zákazník vybere teď, ale zaplatí ji až s domluvenou cenou.",
    group: "Pokladna",
    multiline: true,
    maxLength: 600,
  },

  "pokladna.platba_uvod": {
    label: "Úvodní věta kroku Platba",
    help:
      "Stojí pod otázkou „Jak chcete zaplatit?“ u běžné objednávky — uklidňuje, že se teď ještě neplatí.",
    group: "Pokladna",
    multiline: true,
    maxLength: 400,
  },
  "pokladna.platba_zaloha_kartou": {
    label: "Záloha u zakázky se platí kartou",
    help:
      "Nahrazuje úvodní větu, když je v košíku zakázka se zálohou — tam je karta povinná, i u osobního odběru.",
    group: "Pokladna",
    multiline: true,
    maxLength: 400,
  },
  "pokladna.platba_na_miste": {
    label: "Platba při osobním odběru",
    help: "Popisek u způsobu platby „na místě“ v seznamu plateb.",
    group: "Pokladna",
    multiline: false,
    maxLength: 200,
  },

  "objednavka.potvrzeni": {
    label: "Po odeslání objednávky",
    help:
      "První věta na stránce hotové objednávky, hned pod poděkováním. Říká, kam přišlo potvrzení a že se ozvete, jakmile se něco pohne.",
    group: "Hotová objednávka",
    multiline: true,
    maxLength: 400,
    znacky: [{ znacka: "{{email}}", popis: "e-mail, na který potvrzení odešlo", povinna: true }],
  },
  "objednavka.poskozeny_obal": {
    label: "Poškozený obal zásilky",
    help:
      "Ukáže se v žádosti o reklamaci, když zákazník hlásí poškozený obal. Vysvětluje, že škodu na obalu hradí dopravce a náhradu vyplácí adresátovi — ale že se tím práva u vás neztrácejí.",
    group: "Hotová objednávka",
    multiline: true,
    maxLength: 800,
    pravni: true,
  },
}

/**
 * Výchozí znění = to, co v obchodě stálo napevno do 9. 11. 2026.
 *
 * Mění se tady jen při změně kódu; co nastaví majitelka, leží v nastavení
 * obchodu a tohle nepřepisuje.
 */
export const SHOP_TEXT_DEFAULTS: Readonly<ShopTextValues> = Object.freeze({
  "produkt.cekani": "Není skladem — výroba obvykle trvá 3–10 dní.",
  "produkt.cena_po_domluve":
    "Objednáte teď za 0 Kč; cenu vám po domluvě pošlu e-mailem a pak zaplatíte zálohu nebo celou částku.",
  "produkt.recenze_pravidla":
    "Recenze mohou psát přihlášení zákazníci. Štítek „Ověřený nákup“ má jen recenze od zákazníka, který si výrobek u nás koupil. Recenze schvalujeme ručně kvůli spamu a vulgaritám; negativní hodnocení nemažeme.",

  "zakazka.panel_nadpis": "Vyrábí se na zakázku",
  "zakazka.panel_lhuta": "Hotovo do {{dny}} dnů od zahájení výroby{{obvykle}}.",
  "zakazka.panel_lhuta_rozmezi": "Hotovo zhruba za {{rozmezi}}.",
  "zakazka.panel_zaloha":
    "Platí se záloha {{procento}} %{{castka}}. Zbytek doplatíte, až bude hotovo. Po zahájení výroby se záloha nevrací.",
  "zakazka.panel_zaloha_po_domluve":
    "Zálohu domluvíme spolu s cenou — pošlu vám ji e-mailem po objednávce. Zaplatíte buď zálohu, nebo rovnou celou částku; zbytek doplatíte, až bude hotovo. Po zahájení výroby se záloha nevrací.",
  "zakazka.panel_kosik": "Popis a fotky k zakázce přiložíte v košíku.",
  "zakazka.panel_bez_vraceni":
    "Zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ); záloha se po zahájení výroby nevrací.",

  "zakazka.stitek": "Na zakázku · {{zaloha}} · {{vyroba}} · bez 14denní lhůty na vrácení",
  "zakazka.stitek_zaloha": "záloha {{procento}} %",
  "zakazka.stitek_zaloha_po_domluve": "záloha po domluvě ceny",
  "zakazka.stitek_vyroba": "výroba do {{dny}} dnů",

  "zakazka.kroky_nadpis": "Jak zakázka probíhá",
  "zakazka.krok_zahajeni_nazev": "Zahájení výroby",
  "zakazka.krok_zahajeni":
    "Začneme po připsání platby. V den, kdy začneme, vám pošleme e-mail „Zakázka je ve výrobě“ s datem a časem — od něj je výroba zahájena.",
  "zakazka.krok_dokonceni_nazev": "Dokončení",
  "zakazka.krok_dokonceni":
    "Do {{dny}} dnů od zahájení výroby. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.",
  "zakazka.krok_dokonceni_bez_lhuty":
    "Lhůtu od zahájení výroby najdete v potvrzení zakázky. Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu.",
  "zakazka.krok_schvaleni_nazev": "Schválení před výpalem",
  "zakazka.krok_schvaleni":
    "Pošleme vám fotografii hotového tvaru. Máte 5 pracovních dnů (připomeneme se). Schválená podoba je ujednanou vlastností výrobku; nesoulad se zadáním zůstává vadou vždy.",
  "zakazka.krok_odeslani_nazev": "Odeslání",
  "zakazka.krok_odeslani":
    "Do 2 pracovních dnů od doplatku, pojištěný křehký balík — nebo vám dáme vědět, že je kus připravený k vyzvednutí.",
  "zakazka.kroky_zruseni":
    "Zrušíte-li zakázku před zahájením výroby, vrátíme vám všechno; po zahájení se záloha nevrací, zbytek ano. Celé znění v",

  "bezpecnost.nadpis": "Bezpečné používání",
  "bezpecnost.kotveni":
    "Kotvěte do nosného podkladu hmoždinkami a vruty odpovídajícími zdivu a hmotnosti kusu; nezavěšujte nad místa, kde by pád mohl někoho zranit.",
  "bezpecnost.mraz":
    "V zimě v nádobě nenechávejte zamrznout vodu — led ji může roztrhnout.",
  "bezpecnost.strepy":
    "Keramika je křehká: rozbitý kus má ostré hrany, střepy ukliďte opatrně a mimo dosah dětí.",

  "kosik.cena_po_domluve":
    "Výrobky s cenou po domluvě nejsou v částkách výš — cenu vám pošlu e-mailem a zaplatíte ji potom.",
  "kosik.poukaz_vse":
    "Celou objednávku hradí dárkový poukaz — nic dalšího neplatíte.",
  "kosik.poukaz_nastavit":
    "Nejdřív prosím nastavte dárkový poukaz — hodnotu a podobu zvolíte u něj v košíku.",

  "slevy.jeden_kod":
    "Slevový kód jde na objednávku jen jeden — zůstane ten, který slevuje víc. Dárkových poukazů můžete uplatnit víc, i spolu se slevovým kódem.",
  "slevy.poukaz":
    "Poukaz se odečítá ze zboží, které není ve slevě, ne z poštovného — zbytek doplatíte.",
  "slevy.zlevnene": "Na zlevněné kusy se slevové kódy nevztahují.",

  "pokladna.cena_po_domluve_nula":
    "Teď se nic neplatí. Až spolu domluvíme cenu, pošlu vám ji e-mailem — i s poštovným, pokud si kus necháte poslat — a zaplatíte zálohu nebo celou částku.",
  "pokladna.doprava_krehke":
    "Vybrali jste křehký kus. Aby dorazil v pořádku, posíláme ho jen jako křehký balík Českou poštou — nebo si pro něj můžete přijet do ateliéru.",
  "pokladna.doprava_zakazka":
    "Zakázkovou výrobu posíláme jen jako křehký balík. Nebo si pro ni můžete přijet do ateliéru.",
  "pokladna.doprava_cena_po_domluve":
    "V košíku máte výrobek s cenou po domluvě. Vyberte si tady, jak vám ho mám doručit; posílám jen jako křehký balík, nebo si pro kus můžete přijet do ateliéru. Cenu výrobku vám pak pošlu e-mailem a zaplatíte ji až potom.",

  "pokladna.platba_uvod":
    "Vyberte si způsob platby. V dalším kroku uvidíte celou objednávku a teprve pak budete platit.",
  "pokladna.platba_zaloha_kartou":
    "Zálohu u zakázky platíte předem kartou (nebo přes peněženku či banku). Při osobním odběru pak na místě doplatíte zbytek.",
  "pokladna.platba_na_miste": "Zaplatíte na místě, až si to vyzvednete v ateliéru",

  "objednavka.potvrzeni":
    "Potvrzení jsme poslali na {{email}}. Jakmile se něco pohne, ozveme se vám znovu.",
  "objednavka.poskozeny_obal":
    "Poškozený obal je škoda dopravce: nahlaste prosím zásilku na kterékoli poště, nejlépe do dvou pracovních dnů od převzetí — náhradu Česká pošta vyplácí adresátovi, tedy vám. Vezměte s sebou zásilku i s obalem a výplní, nebo aspoň fotky obalu a zboží. Napište prosím i nám; pokud vám na poště reklamaci nepřijmou, vyřídíme ji my — vaše práva u nás na dopravci nezávisí.",
})

/** Jen známé klíče se string hodnotou — co přijde navíc, se zahodí. */
export const pickStoredShopTexts = (value: unknown): StoredShopTexts => {
  const out: StoredShopTexts = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return out
  const source = value as Record<string, unknown>
  for (const key of SHOP_TEXT_KEYS) {
    const stored = source[key]
    if (
      Object.prototype.hasOwnProperty.call(source, key) &&
      typeof stored === "string"
    ) {
      out[key] = stored
    }
  }
  return out
}

/** Totéž pro vypínače: jen známé klíče, jen `true`/`false`. */
export const pickStoredShopTextsOff = (value: unknown): StoredShopTextsOff => {
  const out: StoredShopTextsOff = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return out
  const source = value as Record<string, unknown>
  for (const key of SHOP_TEXT_KEYS) {
    const stored = source[key]
    if (typeof stored === "boolean") out[key] = stored
  }
  return out
}

/** Je věta vypnutá? */
export const isShopTextOff = (
  off: unknown,
  key: ShopTextKey
): boolean => pickStoredShopTextsOff(off)[key] === true

/**
 * Platné hodnoty z uloženého objektu:
 * - klíč chybí → výchozí znění,
 * - `""` → prázdno, větu neukazovat,
 * - jinak oříznutý text.
 *
 * Nikdy nevyhodí — čte se při každém načtení stránky výrobku.
 */
export const resolveShopTexts = (stored: unknown): ShopTextValues => {
  const out: ShopTextValues = { ...SHOP_TEXT_DEFAULTS }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out
  const source = stored as Record<string, unknown>
  for (const key of SHOP_TEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = source[key]
    if (typeof value === "string") out[key] = value.trim()
  }
  return out
}

/**
 * Co má opravdu vidět zákazník: uložená znění, a u vypnutých vět prázdno.
 *
 * Obchod tím o vypínači vůbec nemusí vědět — prázdnou větu nevykreslí, a to
 * je přesně ono. Znění vypnuté věty zůstává uložené, takže zapnutím se vrátí.
 */
export const resolveVisibleShopTexts = (
  stored: unknown,
  off: unknown
): ShopTextValues => {
  const texty = resolveShopTexts(stored)
  const vypnute = pickStoredShopTextsOff(off)
  for (const key of SHOP_TEXT_KEYS) {
    if (vypnute[key]) texty[key] = ""
  }
  return texty
}

/** Platí po změně tytéž texty jako před ní? */
export const sameShopTexts = (a: unknown, b: unknown): boolean => {
  const left = resolveShopTexts(a)
  const right = resolveShopTexts(b)
  return SHOP_TEXT_KEYS.every((key) => left[key] === right[key])
}

/** Platí po změně tytéž vypínače? */
export const sameShopTextsOff = (a: unknown, b: unknown): boolean => {
  const left = pickStoredShopTextsOff(a)
  const right = pickStoredShopTextsOff(b)
  return SHOP_TEXT_KEYS.every(
    (key) => Boolean(left[key]) === Boolean(right[key])
  )
}

/**
 * Proč text nejde uložit (česky, pro formulář i pro zápis), nebo `null`.
 *
 * Prázdné pole projde vždy. Povinná značka ale chybět nesmí: věta o lhůtě
 * bez `{{dny}}` by zamlčela právě ten údaj, kvůli kterému se text upravuje.
 */
export const shopTextProblem = (key: ShopTextKey, value: string): string | null => {
  const meta = SHOP_TEXT_META[key]
  const text = value.trim()
  if (text.length > meta.maxLength) {
    return `„${meta.label}“ smí mít nejvýš ${meta.maxLength} znaků (má ${text.length}).`
  }
  if (!text) return null
  for (const znacka of meta.znacky ?? []) {
    if (znacka.povinna && !text.includes(znacka.znacka)) {
      return `„${meta.label}“ musí obsahovat ${znacka.znacka} — ${znacka.popis}.`
    }
  }
  return null
}

/**
 * Dosadí za značky skutečné hodnoty. Co se nedodá, zůstane nenahrazené —
 * raději ať je v textu vidět `{{dny}}`, než aby věta tiše tvrdila nesmysl.
 */
export const dosadZnacky = (
  text: string,
  hodnoty: Record<string, string | number | null | undefined>
): string => {
  let out = text
  for (const [znacka, hodnota] of Object.entries(hodnoty)) {
    if (hodnota === null || hodnota === undefined) continue
    out = out.split(`{{${znacka}}}`).join(String(hodnota))
  }
  return out
}

/**
 * Složí větu z částí oddělených tečkou a vynechá prázdné — štítek pod cenou
 * se tím sám zkrátí, když nemá co říct (třeba bez vyplněné lhůty).
 */
export const slozStitek = (
  sablona: string,
  hodnoty: Record<string, string>
): string =>
  dosadZnacky(sablona, hodnoty)
    .split("·")
    .map((cast) => cast.trim())
    .filter(Boolean)
    .join(" · ")
