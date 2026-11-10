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
  "kosik.prazdny",
  "kosik.prihlaseni",
  "kosik.baleni",
  "kosik.dobirka_poplatek",
  "kosik.platba_zrusena",
  "kosik.platba_zrusena_vyzva",
  "kosik.platba_ceka_brana",
  "kosik.platba_ceka_prevod",
  "kosik.platba_ceka_obnova",
  "kosik.platba_potvrzuje",
  "pokladna.adresa_vyber",
  "pokladna.firma_uvod",
  "pokladna.firma_nazev",
  "pokladna.firma_dic",
  "pokladna.doprava_poukaz",
  "pokladna.doprava_balikovna_vyber",
  "pokladna.doprava_vydejni_vyber",
  "pokladna.doprava_zmena",
  "pokladna.platba_balikovna_karta",
  "zakazka.brief_uvod",
  "zakazka.brief_kosik",
  "zakazka.brief_vyzva",
  "zakazka.brief_poznamka",
  "zakazka.doplatek_recap",
  "zakazka.seznam_uvod",
  "objednavka.doplatek_prisel",
  "objednavka.doplatek_zrusen",
  "objednavka.doplatek_zpracovava",
  "objednavka.doplatek_odkaz_neplati",
  "objednavka.prevzeti_obal",
  "objednavka.prevzeti_stav",
  "objednavka.podrobnosti_email",
  "order.carrier_damage_2",
  "order.claim_status_8",
  "order.commission_conversation_1",
  "order.commission_conversation_2",
  "order.order_edit_1",
  "order.order_edit_2",
  "order.order_edit_3",
  "order.order_edit_4",
  "order.order_edit_5",
  "order.order_edit_6",
  "order.order_edit_7",
  "order.order_edit_8",
  "order.order_edit_9",
  "order.order_edit_10",
  "order.order_edit_11",
  "order.order_edit_12",
  "order.order_edit_13",
  "order.order_edit_14",
  "order.order_edit_15",
  "order.order_edit_22",
  "order.order_edit_23",
  "order.order_edit_24",
  "order.order_edit_25",
  "order.order_edit_26",
  "order.order_edit_27",
  "order.order_edit_28",
  "order.order_edit_29",
  "order.transfer_actions_1",
  "order.transfer_actions_2",
  "order.transfer_actions_3",
  "order.withdrawal_1",
  "order.withdrawal_2",
  "order.templates_6",
  "order.templates_7",
  "order.templates_8",
  "order.templates_9",
  "order.templates_10",
  "kurzy.accountkurzy_1",
  "kurzy.accountkurzy_2",
  "kurzy.rezervacemodal_2",
  "kurzy.rezervacemodal_3",
  "kurzy.rezervacemodal_4",
  "kurzy.rezervacemodal_5",
  "kurzy.rezervacemodal_6",
  "kurzy.rezervacemodal_7",
  "kurzy.rezervacemodal_8",
  "kurzy.rezervacemodal_9",
  "kurzy.rezervacemodal_10",
  "kurzy.rezervacemodal_11",
  "kurzy.rezervacemodal_12",
  "kurzy.rezervacemodal_13",
  "account.address_card_1",
  "account.delete_account_1",
  "account.delete_account_2",
  "account.profile_password_1",
  "account.share_button_1",
  "account.transfer_request_form_1",
  "account.templates_2",
  "account.templates_3",
  "account.templates_4",
  "account.templates_7",
  "account.templates_8",
  "account.templates_9",
  "account.templates_10",
  "account.templates_11",
  "account.templates_12",
  "account.templates_13",
  "account.templates_14",
  "account.templates_15",
  "account.templates_16",
  "account.templates_17",
  "account.templates_18",
  "account.templates_19",
  "account.templates_20",
  "account.templates_21",
  "account.templates_22",
  "account.templates_23",
  "account.templates_24",
  "account.templates_25",
  "account.templates_26",
  "products.bundle_actions_1",
  "products.bundle_actions_2",
  "products.made_to_order_notice_1",
  "products.product_reviews_1",
  "products.product_reviews_2",
  "products.product_reviews_3",
  "products.product_reviews_4",
  "products.details_2",
  "products.chapter_1",
  "products.chapter_2",
  "products.chapter_3",
  "products.chapter_4",
  "products.buy_now_1",
  "products.price_1",
  "products.price_3",
  "products.price_4",
  "products.price_5",
  "products.details_3",
  "products.sold_1",
  "products.sold_2",
  "products.sold_3",
  "checkout.address_select_1",
  "checkout.addresses_1",
  "checkout.addresses_2",
  "checkout.commission_brief_1",
  "checkout.discount_code_1",
  "checkout.order_summary_disclosure_1",
  "checkout.payment_1",
  "checkout.payment_2",
  "checkout.production_payment_mode_1",
  "checkout.shipping_1",
  "checkout.shipping_2",
  "checkout.shipping_address_1",
  "poukaz.poukazdetail_1",
  "poukaz.poukazdetail_2",
  "poukaz.poukazdetail_3",
  "poukaz.poukazdetail_4",
  "poukaz.poukazdetail_5",
  "poukaz.poukazdetail_7",
  "poukaz.poukazdetail_8",
  "poukaz.poukazdetail_9",
  "poukaz.poukazdetail_10",
  "poukaz.poukazdetail_12",
  "poukaz.poukazdetail_14",
  "poukaz.poukazdetail_15",
  "poukaz.poukazdetail_16",
  "poukaz.poukazdetail_17",
  "poukaz.poukazkarta_1",
  "store.shophero_1",
  "legal.downloads_1",
  "legal.legaldocument_1",
  "certifikaty.certifikaty_1",
  "certifikaty.certifikaty_2",
  "certifikaty.certifikaty_3",
  "certifikaty.certifikaty_4",
  "certifikaty.certifikaty_5",
  "certifikaty.certifikaty_6",
  "certifikaty.certifikaty_7",
  "cart.item_1",
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

/**
 * Záložky stránky — podle toho, ČEHO se text týká.
 *
 * Bez nich by formulář byl sto čtyřicet polí pod sebou a nedalo by se v něm
 * nic najít (Matěj, 9. 11. 2026). Uvnitř záložky pak skupiny říkají, KDE
 * v obchodě text stojí — u zakázky třeba stránka výrobku, košík, pokladna
 * a objednávka, protože tatáž věc se zákazníkovi připomíná na čtyřech
 * místech a každé má jinou větu.
 */
export const SHOP_TEXT_OBLASTI = [
  "Výrobek",
  "Zakázková výroba",
  "Košík",
  "Pokladna",
  "Objednávka",
  "Reklamace a vrácení",
  "Úprava objednávky",
  "Kurzy",
  "Dárkové poukazy",
  "Účet zákazníka",
] as const

export type ShopTextOblast = (typeof SHOP_TEXT_OBLASTI)[number]

/**
 * Skupiny v pořadí, v jakém je stránka ukazuje, každá se svou záložkou.
 *
 * Záložka se odvozuje od skupiny, ne od klíče: tím nemůže vzniknout text,
 * který visí v jedné záložce a v nadpisu tvrdí něco jiného.
 */
export const SHOP_TEXT_GROUP_LIST = [
  { nazev: "Dostupnost a cena", oblast: "Výrobek" },
  { nazev: "Bezpečné používání", oblast: "Výrobek" },
  { nazev: "Recenze", oblast: "Výrobek" },

  { nazev: "Panel u ceny (stránka výrobku)", oblast: "Zakázková výroba" },
  { nazev: "Štítek pod cenou (stránka výrobku)", oblast: "Zakázková výroba" },
  { nazev: "Jak zakázka probíhá (stránka výrobku)", oblast: "Zakázková výroba" },
  { nazev: "Zadání zakázky (košík a pokladna)", oblast: "Zakázková výroba" },
  { nazev: "Zakázka v objednávce", oblast: "Zakázková výroba" },

  { nazev: "Prázdný košík a přihlášení", oblast: "Košík" },
  { nazev: "Souhrn košíku", oblast: "Košík" },
  { nazev: "Slevy a poukazy", oblast: "Košík" },
  { nazev: "Stavy platby", oblast: "Košík" },

  { nazev: "Doručení", oblast: "Pokladna" },
  { nazev: "Adresy a firemní údaje", oblast: "Pokladna" },
  { nazev: "Platba", oblast: "Pokladna" },

  { nazev: "Po odeslání", oblast: "Objednávka" },
  { nazev: "Převzetí zásilky", oblast: "Objednávka" },
  { nazev: "Doplatek", oblast: "Objednávka" },

  { nazev: "Druhy žádostí", oblast: "Reklamace a vrácení" },
  { nazev: "Formulář žádosti", oblast: "Reklamace a vrácení" },
  { nazev: "Lhůty a poučení", oblast: "Reklamace a vrácení" },
  { nazev: "Stav žádosti", oblast: "Reklamace a vrácení" },
  { nazev: "Poškozená zásilka", oblast: "Reklamace a vrácení" },

  { nazev: "Co jde měnit", oblast: "Úprava objednávky" },
  { nazev: "Zboží v úpravě", oblast: "Úprava objednávky" },
  { nazev: "Doručení v úpravě", oblast: "Úprava objednávky" },
  { nazev: "Rozdíl ceny a doplacení", oblast: "Úprava objednávky" },

  { nazev: "Objednávka — poškozená zásilka", oblast: "Reklamace a vrácení" },
  { nazev: "Objednávka — stav žádosti", oblast: "Reklamace a vrácení" },
  { nazev: "Objednávka — konverzace k zakázce", oblast: "Zakázková výroba" },
  { nazev: "Objednávka — úprava", oblast: "Úprava objednávky" },
  { nazev: "Objednávka — převod na jiný účet", oblast: "Objednávka" },
  { nazev: "Objednávka — odstoupení od smlouvy", oblast: "Reklamace a vrácení" },
  { nazev: "Objednávka — detail", oblast: "Objednávka" },

  { nazev: "Kurzy — moje rezervace", oblast: "Kurzy" },
  { nazev: "Kurzy — rezervační okno", oblast: "Kurzy" },

  { nazev: "Účet — uložené adresy", oblast: "Účet zákazníka" },
  { nazev: "Účet — zrušení účtu", oblast: "Účet zákazníka" },
  { nazev: "Účet — změna hesla", oblast: "Účet zákazníka" },
  { nazev: "Účet — sdílení", oblast: "Účet zákazníka" },
  { nazev: "Účet — převod objednávky", oblast: "Účet zákazníka" },
  { nazev: "Účet — zapomenuté heslo", oblast: "Účet zákazníka" },
  { nazev: "Účet — nastavení nového hesla", oblast: "Účet zákazníka" },
  { nazev: "Účet — moje recenze", oblast: "Účet zákazníka" },
  { nazev: "Účet — ověření e-mailu znovu", oblast: "Účet zákazníka" },
  { nazev: "Účet — ověření e-mailu", oblast: "Účet zákazníka" },
  { nazev: "Účet — oblíbené", oblast: "Účet zákazníka" },

  { nazev: "Výrobek — balíček", oblast: "Výrobek" },
  { nazev: "Výrobek — poučení u zakázky", oblast: "Zakázková výroba" },
  { nazev: "Výrobek — recenze", oblast: "Výrobek" },
  { nazev: "Výrobek — stránka výrobku", oblast: "Výrobek" },

  { nazev: "Pokladna — výběr adresy", oblast: "Pokladna" },
  { nazev: "Pokladna — adresy", oblast: "Pokladna" },
  { nazev: "Pokladna — zadání zakázky", oblast: "Zakázková výroba" },
  { nazev: "Pokladna — slevový kód", oblast: "Pokladna" },
  { nazev: "Pokladna — souhrn objednávky", oblast: "Pokladna" },
  { nazev: "Pokladna — platba", oblast: "Pokladna" },
  { nazev: "Pokladna — záloha u zakázky", oblast: "Pokladna" },
  { nazev: "Pokladna — doručení", oblast: "Pokladna" },
  { nazev: "Pokladna — dodací adresa", oblast: "Pokladna" },

  { nazev: "Poukaz — stránka poukazu", oblast: "Dárkové poukazy" },
  { nazev: "Poukaz — karta poukazu", oblast: "Dárkové poukazy" },

  { nazev: "Obchod — výpis výrobků", oblast: "Výrobek" },

  { nazev: "Doprava zdarma — upozornění", oblast: "Objednávka" },

  { nazev: "Dokumenty ke stažení", oblast: "Objednávka" },
  { nazev: "Právní dokument na webu", oblast: "Objednávka" },

  { nazev: "Certifikáty a protokoly", oblast: "Objednávka" },

  { nazev: "Košík — řádek zboží", oblast: "Košík" },
] as const

export type ShopTextGroup = (typeof SHOP_TEXT_GROUP_LIST)[number]["nazev"]

/** Jen názvy — zpětně kompatibilní s dřívějším `SHOP_TEXT_GROUPS`. */
export const SHOP_TEXT_GROUPS = SHOP_TEXT_GROUP_LIST.map(
  (skupina) => skupina.nazev
) as readonly ShopTextGroup[]

/** Do které záložky skupina patří. */
export const oblastSkupiny = (group: ShopTextGroup): ShopTextOblast =>
  SHOP_TEXT_GROUP_LIST.find((skupina) => skupina.nazev === group)?.oblast ??
  "Výrobek"

/** Skupiny jedné záložky, v pořadí. */
export const skupinyOblasti = (oblast: ShopTextOblast): ShopTextGroup[] =>
  SHOP_TEXT_GROUP_LIST.filter((skupina) => skupina.oblast === oblast).map(
    (skupina) => skupina.nazev
  )

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
    group: "Dostupnost a cena",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/store",
  },
  "produkt.cena_po_domluve": {
    label: "Cena po domluvě — věta pod cenou",
    help:
      "Ukáže se u výrobku, který má cenu po domluvě. Musí být jasné, že objednávka je závazná, ale teď se neplatí nic.",
    group: "Dostupnost a cena",
    multiline: true,
    maxLength: 400,
  },

  "produkt.recenze_pravidla": {
    label: "Pravidla recenzí",
    help:
      "Ukáže se pod recenzemi u výrobku, ve formuláři na novou recenzi a v účtu. Vysvětluje, kdo smí psát a co znamená „Ověřený nákup“.",
    group: "Recenze",
    multiline: true,
    maxLength: 600,
    pravni: true,
  },

  "zakazka.panel_nadpis": {
    label: "Nadpis panelu",
    help: "Záhlaví rámečku u ceny zakázkového výrobku.",
    group: "Panel u ceny (stránka výrobku)",
    multiline: false,
    maxLength: 80,
  },
  "zakazka.panel_lhuta": {
    label: "Lhůta (když je v profilu vyplněná)",
    help:
      "První věta panelu. Číslo dnů se bere z výrobního profilu toho kusu, takže jedno znění platí pro hrnek i pro plastiku.",
    group: "Panel u ceny (stránka výrobku)",
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
    group: "Panel u ceny (stránka výrobku)",
    multiline: true,
    maxLength: 300,
    znacky: [{ znacka: "{{rozmezi}}", popis: "rozpětí z profilu, např. „14–42 dní“", povinna: true }],
  },
  "zakazka.panel_zaloha": {
    label: "Záloha v procentech",
    help:
      "Platí, když je cena známá. Procento je z profilu výroby; částka se dopočítá z ceny provedení a bez ní se vynechá.",
    group: "Panel u ceny (stránka výrobku)",
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
    group: "Panel u ceny (stránka výrobku)",
    multiline: true,
    maxLength: 500,
  },
  "zakazka.panel_kosik": {
    label: "Kde se zadává popis a fotky",
    help: "Věta, která zákazníkovi řekne, že zadání píše až v košíku, ne tady.",
    group: "Panel u ceny (stránka výrobku)",
    multiline: true,
    maxLength: 300,
  },
  "zakazka.panel_bez_vraceni": {
    label: "Poučení o 14denní lhůtě",
    help:
      "Zákazník to musí vědět PŘED objednávkou (§ 1820 odst. 1 písm. j) OZ) a v pokladně to ještě potvrdí zaškrtnutím. Totéž znění se krátí do štítku pod cenou.",
    group: "Panel u ceny (stránka výrobku)",
    multiline: true,
    maxLength: 400,
    pravni: true,
  },

  "zakazka.stitek": {
    label: "Štítek pod cenou — skladba",
    help:
      "Jednořádkový štítek pod cenou. Části oddělené tečkou se samy vynechají, když nemají co říct (třeba bez vyplněné lhůty).",
    group: "Štítek pod cenou (stránka výrobku)",
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
    group: "Štítek pod cenou (stránka výrobku)",
    multiline: false,
    maxLength: 100,
    znacky: [{ znacka: "{{procento}}", popis: "záloha v procentech", povinna: true }],
  },
  "zakazka.stitek_zaloha_po_domluve": {
    label: "Štítek — záloha u ceny po domluvě",
    help: "Dosadí se za {{zaloha}} u kusu s cenou po domluvě.",
    group: "Štítek pod cenou (stránka výrobku)",
    multiline: false,
    maxLength: 100,
  },
  "zakazka.stitek_vyroba": {
    label: "Štítek — část o lhůtě",
    help: "Dosadí se za {{vyroba}}, když je v profilu nejdelší lhůta.",
    group: "Štítek pod cenou (stránka výrobku)",
    multiline: false,
    maxLength: 100,
    znacky: [{ znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech", povinna: true }],
  },

  "zakazka.kroky_nadpis": {
    label: "Nadpis bloku",
    help: "Záhlaví čtyř kroků pod tlačítkem u zakázkového výrobku.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: false,
    maxLength: 80,
  },
  "zakazka.krok_zahajeni_nazev": {
    label: "Krok 1 — název",
    help: "Tučné slovo na začátku prvního kroku.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_zahajeni": {
    label: "Krok 1 — text",
    help:
      "Kdy se začíná vyrábět. Totéž čte zákazník i v PDF Potvrzení zakázky, bod 05.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_dokonceni_nazev": {
    label: "Krok 2 — název",
    help: "Tučné slovo na začátku druhého kroku.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_dokonceni": {
    label: "Krok 2 — text (se lhůtou)",
    help:
      "Platí u zakázky, která má ve výrobním profilu vyplněnou nejdelší lhůtu. Právě tady se mění ta lhůta, co je na plastiky krátká — číslo se bere z profilu, věta jen říká, jak se podá.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: true,
    maxLength: 600,
    znacky: [{ znacka: "{{dny}}", popis: "nejdelší lhůta ve dnech z profilu výroby", povinna: true }],
  },
  "zakazka.krok_dokonceni_bez_lhuty": {
    label: "Krok 2 — text (bez lhůty)",
    help:
      "Platí u zakázky, která lhůtu v profilu vyplněnou nemá. Nesmí slibovat termín — jen říct, kde ho zákazník najde.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_schvaleni_nazev": {
    label: "Krok 3 — název",
    help: "Tučné slovo na začátku třetího kroku.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_schvaleni": {
    label: "Krok 3 — text",
    help: "Kdy posíláte fotku hotového tvaru a kolik času má zákazník na odpověď.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.krok_odeslani_nazev": {
    label: "Krok 4 — název",
    help: "Tučné slovo na začátku čtvrtého kroku.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: false,
    maxLength: 60,
  },
  "zakazka.krok_odeslani": {
    label: "Krok 4 — text",
    help: "Co se stane po doplatku — odeslání, nebo připravení k vyzvednutí.",
    group: "Jak zakázka probíhá (stránka výrobku)",
    multiline: true,
    maxLength: 600,
  },
  "zakazka.kroky_zruseni": {
    label: "Zrušení zakázky (věta pod kroky)",
    help:
      "Poslední odstavec bloku. Odkaz na obchodní podmínky se připojí sám za touhle větou.",
    group: "Jak zakázka probíhá (stránka výrobku)",
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
    group: "Souhrn košíku",
    multiline: true,
    maxLength: 400,
    nahled: "/cz/cart",
  },
  "kosik.poukaz_vse": {
    label: "Celou objednávku hradí poukaz",
    help: "Věta u tlačítka, když dárkový poukaz pokryl celou částku a nic se nedoplácí.",
    group: "Souhrn košíku",
    multiline: true,
    maxLength: 400,
  },

  "kosik.poukaz_nastavit": {
    label: "Poukaz ještě není nastavený",
    help:
      "Ukáže se v košíku, když je v něm dárkový poukaz bez vybrané hodnoty nebo podoby. Do pokladny to tak jako tak nepustí.",
    group: "Slevy a poukazy",
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
    group: "Platba",
    multiline: true,
    maxLength: 500,
    nahled: "/cz/checkout",
  },
  "pokladna.doprava_krehke": {
    label: "Doručení — křehký kus",
    help:
      "Vysvětlení v kroku Doručení, proč jsou na výběr jen křehký balík a osobní odběr.",
    group: "Doručení",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_zakazka": {
    label: "Doručení — zakázková výroba",
    help: "Totéž u zakázkové výroby.",
    group: "Doručení",
    multiline: true,
    maxLength: 500,
  },
  "pokladna.doprava_cena_po_domluve": {
    label: "Doručení — cena po domluvě",
    help:
      "Totéž u kusu s cenou po domluvě. Navíc musí být jasné, že dopravu si zákazník vybere teď, ale zaplatí ji až s domluvenou cenou.",
    group: "Doručení",
    multiline: true,
    maxLength: 600,
  },

  "pokladna.platba_uvod": {
    label: "Úvodní věta kroku Platba",
    help:
      "Stojí pod otázkou „Jak chcete zaplatit?“ u běžné objednávky — uklidňuje, že se teď ještě neplatí.",
    group: "Platba",
    multiline: true,
    maxLength: 400,
  },
  "pokladna.platba_zaloha_kartou": {
    label: "Záloha u zakázky se platí kartou",
    help:
      "Nahrazuje úvodní větu, když je v košíku zakázka se zálohou — tam je karta povinná, i u osobního odběru.",
    group: "Platba",
    multiline: true,
    maxLength: 400,
  },
  "pokladna.platba_na_miste": {
    label: "Platba při osobním odběru",
    help: "Popisek u způsobu platby „na místě“ v seznamu plateb.",
    group: "Platba",
    multiline: false,
    maxLength: 200,
  },

  "objednavka.potvrzeni": {
    label: "Po odeslání objednávky",
    help:
      "První věta na stránce hotové objednávky, hned pod poděkováním. Říká, kam přišlo potvrzení a že se ozvete, jakmile se něco pohne.",
    group: "Po odeslání",
    multiline: true,
    maxLength: 400,
    znacky: [{ znacka: "{{email}}", popis: "e-mail, na který potvrzení odešlo", povinna: true }],
  },
  "objednavka.poskozeny_obal": {
    label: "Poškozený obal zásilky",
    help:
      "Ukáže se v žádosti o reklamaci, když zákazník hlásí poškozený obal. Vysvětluje, že škodu na obalu hradí dopravce a náhradu vyplácí adresátovi — ale že se tím práva u vás neztrácejí.",
    group: "Poškozená zásilka",
    multiline: true,
    maxLength: 800,
    pravni: true,
  },
  "kosik.prazdny": {
    label: "Prázdný košík",
    help:
      "Věta pod nadpisem, když v košíku nic není.",
    group: "Prázdný košík a přihlášení",
    multiline: true,
    maxLength: 200,
  },
  "kosik.prihlaseni": {
    label: "Pozvánka k přihlášení",
    help:
      "Věta nad tlačítkem Přihlásit se v košíku nepřihlášeného zákazníka.",
    group: "Prázdný košík a přihlášení",
    multiline: false,
    maxLength: 200,
  },
  "kosik.baleni": {
    label: "Jak balíte",
    help:
      "Věta u seznamu zboží v košíku — o tom, že se kusy balí ručně v ateliéru.",
    group: "Souhrn košíku",
    multiline: true,
    maxLength: 200,
  },
  "kosik.dobirka_poplatek": {
    label: "Poplatek za dobírku",
    help:
      "Popisek u řádku doběrečného v košíku.",
    group: "Souhrn košíku",
    multiline: true,
    maxLength: 200,
  },
  "kosik.platba_zrusena": {
    label: "Platba se nedokončila",
    help:
      "Ukáže se po návratu z platební brány, když zákazník platbu zrušil.",
    group: "Stavy platby",
    multiline: false,
    maxLength: 200,
  },
  "kosik.platba_zrusena_vyzva": {
    label: "Výzva k zaplacení po zrušené platbě",
    help:
      "Druhá věta téže stránky — proč se bez zaplacení nedá nic poslat.",
    group: "Stavy platby",
    multiline: true,
    maxLength: 250,
  },
  "kosik.platba_ceka_brana": {
    label: "Platba zatím nedorazila",
    help:
      "Ukáže se, když platba na bráně skončila nerozhodně — třeba zavřeným oknem.",
    group: "Stavy platby",
    multiline: true,
    maxLength: 400,
  },
  "kosik.platba_ceka_prevod": {
    label: "Čekání na potvrzení převodu",
    help:
      "Ukáže se u bankovního převodu, který banka ještě nepotvrdila.",
    group: "Stavy platby",
    multiline: true,
    maxLength: 300,
  },
  "kosik.platba_ceka_obnova": {
    label: "Stránka se obnoví sama",
    help:
      "Uklidňující věta pod čekáním na platbu.",
    group: "Stavy platby",
    multiline: true,
    maxLength: 200,
  },
  "kosik.platba_potvrzuje": {
    label: "Objednávka se ukládá",
    help:
      "Ukáže se mezi zaplacením a hotovou objednávkou.",
    group: "Stavy platby",
    multiline: true,
    maxLength: 200,
  },
  "pokladna.adresa_vyber": {
    label: "Výběr uložené adresy",
    help:
      "Věta nad seznamem uložených adres v kroku Doručení.",
    group: "Adresy a firemní údaje",
    multiline: false,
    maxLength: 200,
  },
  "pokladna.firma_uvod": {
    label: "Nákup na firmu — úvod",
    help:
      "Vysvětlení nad firemními poli: na co se vystaví doklad a kam půjde zboží.",
    group: "Adresy a firemní údaje",
    multiline: true,
    maxLength: 200,
  },
  "pokladna.firma_nazev": {
    label: "Nákup na firmu — název",
    help:
      "Nápověda u pole s názvem firmy.",
    group: "Adresy a firemní údaje",
    multiline: true,
    maxLength: 200,
  },
  "pokladna.firma_dic": {
    label: "Nákup na firmu — DIČ",
    help:
      "Nápověda pod polem DIČ v nákupu na firmu — jaký tvar se čeká a že neplátce DPH pole nechá prázdné.",
    group: "Adresy a firemní údaje",
    multiline: true,
    maxLength: 200,
  },
  "pokladna.doprava_poukaz": {
    label: "Elektronický poukaz bez dopravy",
    help:
      "Ukáže se, když je v košíku jen elektronický dárkový poukaz.",
    group: "Doručení",
    multiline: false,
    maxLength: 200,
  },
  "pokladna.doprava_balikovna_vyber": {
    label: "Vyberte Balíkovnu",
    help:
      "Výzva, dokud zákazník nevybral výdejní místo Balíkovny.",
    group: "Doručení",
    multiline: false,
    maxLength: 200,
  },
  "pokladna.doprava_vydejni_vyber": {
    label: "Vyberte výdejní místo",
    help:
      "Totéž u výdejních míst v mapě.",
    group: "Doručení",
    multiline: false,
    maxLength: 200,
  },
  "pokladna.doprava_zmena": {
    label: "Dopravu jde ještě změnit",
    help:
      "Uklidňující věta pod výběrem dopravy.",
    group: "Doručení",
    multiline: false,
    maxLength: 200,
  },
  "pokladna.platba_balikovna_karta": {
    label: "Na Balíkovnu jen kartou",
    help:
      "Vysvětlení, proč u Balíkovny není dobírka.",
    group: "Platba",
    multiline: true,
    maxLength: 250,
  },
  "zakazka.brief_uvod": {
    label: "Zadání zakázky — úvod (krok v pokladně)",
    help:
      "Věta nad poli pro zadání zakázky ve vlastním kroku pokladny.",
    group: "Zadání zakázky (košík a pokladna)",
    multiline: true,
    maxLength: 200,
  },
  "zakazka.brief_kosik": {
    label: "Zadání zakázky — úvod (košík)",
    help:
      "Totéž u zakázky v košíku.",
    group: "Zadání zakázky (košík a pokladna)",
    multiline: true,
    maxLength: 200,
  },
  "zakazka.brief_vyzva": {
    label: "Zadání zakázky — výzva",
    help:
      "Krátká výzva u prázdného zadání.",
    group: "Zadání zakázky (košík a pokladna)",
    multiline: false,
    maxLength: 200,
  },
  "zakazka.brief_poznamka": {
    label: "Zadání zakázky — poznámka",
    help:
      "Věta u pole pro doplňující poznámku vedle fotek.",
    group: "Zadání zakázky (košík a pokladna)",
    multiline: true,
    maxLength: 200,
  },
  "zakazka.doplatek_recap": {
    label: "Kdy se platí zbytek",
    help:
      "Věta v souhrnu pokladny u zakázky se zálohou.",
    group: "Zadání zakázky (košík a pokladna)",
    multiline: true,
    maxLength: 200,
  },
  "zakazka.seznam_uvod": {
    label: "Seznam zakázek v objednávce",
    help:
      "Věta nad výpisem zakázek na stránce objednávky.",
    group: "Zakázka v objednávce",
    multiline: true,
    maxLength: 200,
  },
  "objednavka.doplatek_prisel": {
    label: "Doplatek dorazil",
    help:
      "Ukáže se po úspěšném zaplacení doplatku z odkazu v e-mailu.",
    group: "Doplatek",
    multiline: false,
    maxLength: 200,
  },
  "objednavka.doplatek_zrusen": {
    label: "Doplatek se zrušil",
    help:
      "Ukáže se, když zákazník platbu doplatku zrušil.",
    group: "Doplatek",
    multiline: true,
    maxLength: 200,
  },
  "objednavka.doplatek_zpracovava": {
    label: "Doplatek se zpracovává",
    help:
      "Ukáže se, dokud banka platbu nepotvrdí.",
    group: "Doplatek",
    multiline: true,
    maxLength: 200,
  },
  "objednavka.doplatek_odkaz_neplati": {
    label: "Odkaz na doplatek vypršel",
    help:
      "Ukáže se u prošlého platebního odkazu.",
    group: "Doplatek",
    multiline: true,
    maxLength: 200,
  },
  "objednavka.prevzeti_obal": {
    label: "Co dělat při převzetí",
    help:
      "Hlavní rada u objednávky na cestě: prohlédnout obal a případně rozbalit před doručovatelem.",
    group: "Převzetí zásilky",
    multiline: true,
    maxLength: 500,
    pravni: true,
  },
  "objednavka.prevzeti_stav": {
    label: "Kdo za co odpovídá",
    help:
      "Rozdíl mezi poškozeným obalem (dopravce) a rozbitým kusem v celé krabici (vy).",
    group: "Převzetí zásilky",
    multiline: true,
    maxLength: 250,
    pravni: true,
  },
  "objednavka.podrobnosti_email": {
    label: "Kde najít podrobnosti",
    help:
      "Věta po návratu z platební brány, když se stránka objednávky nenačte.",
    group: "Po odeslání",
    multiline: true,
    maxLength: 200,
  },
  "order.carrier_damage_2": {
    label: "Krabice v pořádku, rozbitý výrobek",
    help: "Kde se ukáže: order: carrier damage.",
    group: "Objednávka — poškozená zásilka",
    multiline: false,
    maxLength: 200,
  },
  "order.claim_status_8": {
    label: "Vráceno méně než cena vybraných položek —…",
    help: "Kde se ukáže: order: claim status.",
    group: "Objednávka — stav žádosti",
    multiline: true,
    maxLength: 200,
  },
  "order.commission_conversation_1": {
    label: "Napište mi — čtu to u rozdělané práce.",
    help: "Kde se ukáže: order: commission conversation.",
    group: "Objednávka — konverzace k zakázce",
    multiline: false,
    maxLength: 200,
  },
  "order.commission_conversation_2": {
    label: "Napadlo vás ještě něco? Napište mi.",
    help: "Kde se ukáže: order: commission conversation.",
    group: "Objednávka — konverzace k zakázce",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_1": {
    label: "K objednávce běží dřívější úprava, která…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 350,
  },
  "order.order_edit_2": {
    label: "Jiný kus, jiné provedení, něco přidat nebo…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 350,
  },
  "order.order_edit_3": {
    label: "Objednávka už se chystá na cestu — doručení…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_4": {
    label: "Výdejní místo můžete změnit, dokud zásilku…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_5": {
    label: "Doručovací adresu můžete změnit, dokud…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_6": {
    label: "Objednávku si vyzvednete osobně — doručení…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_7": {
    label: "Zatím žádná změna. Upravte počet, vyměňte…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 250,
  },
  "order.order_edit_8": {
    label: "Víc než 30 změn najednou uložit nejde —…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_9": {
    label: "Přesměrováváme vás na platbu rozdílu…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_10": {
    label: "Víc změn najednou uložit nejde — nejdřív…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_11": {
    label: "Zabaleno — vyměnit jde jen varianta za…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_12": {
    label: "Upravit můžete, dokud nezačneme balit.",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_13": {
    label: "Úpravu jste uložili, ale rozdíl ještě není…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 300,
  },
  "order.order_edit_14": {
    label: "K objednávce běží nedokončená úprava. Když…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_15": {
    label: "U dobírky nabízíme jen kusy, které jde…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_22": {
    label: "Tohle provedení za váš kus vyměnit nejde —…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_23": {
    label: "Tohle provedení za váš kus vyměnit nejde —…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_24": {
    label: "Jen kusy, které jde k objednávce přidat.…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 250,
  },
  "order.order_edit_25": {
    label: "Objednávka je zabalená — vyměnit jde jen za…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_26": {
    label: "Jiné provedení · rozdíl za kus",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_27": {
    label: "Jiné provedení teď vybrat nejde. Kdybyste…",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: true,
    maxLength: 200,
  },
  "order.order_edit_28": {
    label: "Jen za výrobek ve stejné ceně.",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.order_edit_29": {
    label: "Cokoli z obchodu, rozdíl ceny se vyrovná.",
    help: "Kde se ukáže: order: order edit.",
    group: "Objednávka — úprava",
    multiline: false,
    maxLength: 200,
  },
  "order.transfer_actions_1": {
    label: "Objednávka teď patří novému majiteli.",
    help: "Kde se ukáže: order: transfer actions.",
    group: "Objednávka — převod na jiný účet",
    multiline: false,
    maxLength: 200,
  },
  "order.transfer_actions_2": {
    label: "Podrobnosti najdete ve svém účtu.",
    help: "Kde se ukáže: order: transfer actions.",
    group: "Objednávka — převod na jiný účet",
    multiline: false,
    maxLength: 200,
  },
  "order.transfer_actions_3": {
    label: "S touhle žádostí už nemusíte nic dělat.",
    help: "Kde se ukáže: order: transfer actions.",
    group: "Objednávka — převod na jiný účet",
    multiline: false,
    maxLength: 200,
  },
  "order.withdrawal_1": {
    label: "Rozmysleli jste si to? Od smlouvy můžete…",
    help: "Kde se ukáže: order: withdrawal.",
    group: "Objednávka — odstoupení od smlouvy",
    multiline: true,
    maxLength: 250,
  },
  "order.withdrawal_2": {
    label: "Od smlouvy můžete odstoupit bez udání důvodu…",
    help: "Kde se ukáže: order: withdrawal.",
    group: "Objednávka — odstoupení od smlouvy",
    multiline: false,
    maxLength: 200,
  },
  "order.templates_6": {
    label: "05 · odstoupení, reklamace a vrácení",
    help: "Kde se ukáže: order: order details template.",
    group: "Objednávka — detail",
    multiline: false,
    maxLength: 200,
  },
  "order.templates_7": {
    label: "Úprava objednávky čeká na zaplacení rozdílu…",
    help: "Kde se ukáže: order: order details template.",
    group: "Objednávka — detail",
    multiline: true,
    maxLength: 200,
  },
  "order.templates_8": {
    label: "Potřebujete změnit doručovací adresu nebo…",
    help: "Kde se ukáže: order: order details template.",
    group: "Objednávka — detail",
    multiline: true,
    maxLength: 200,
  },
  "order.templates_9": {
    label: "Objednávka je zabalená — vyměnit jde ještě…",
    help: "Kde se ukáže: order: order details template.",
    group: "Objednávka — detail",
    multiline: true,
    maxLength: 200,
  },
  "order.templates_10": {
    label: "Objednávku můžete ještě upravit — počet…",
    help: "Kde se ukáže: order: order details template.",
    group: "Objednávka — detail",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.accountkurzy_1": {
    label: "Rezervovaná místa v ateliéru — termín, počet…",
    help: "Kde se ukáže: kurzy: AccountKurzy.",
    group: "Kurzy — moje rezervace",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.accountkurzy_2": {
    label: "Vypsané termíny kurzů najdete na stránce…",
    help: "Kde se ukáže: kurzy: AccountKurzy.",
    group: "Kurzy — moje rezervace",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_2": {
    label: "Kurzy probíhají v ateliéru v Písku a…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 350,
  },
  "kurzy.rezervacemodal_3": {
    label: "Ceny se u jednotlivých termínů liší —…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_4": {
    label: "E-mail a telefon použijeme jen k vyřízení…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_5": {
    label: "Bezpečně přes ComGate, místo máte jisté hned.",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: false,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_6": {
    label: "Hotově nebo převodem na účet před začátkem…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: false,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_7": {
    label: "Kurz má pevný termín, proto u něj neplatí…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 300,
  },
  "kurzy.rezervacemodal_8": {
    label: "Souhlasím s pořízením fotografií z kurzu a…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 250,
  },
  "kurzy.rezervacemodal_9": {
    label: "Vyberte prosím termín s volnými místy.",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: false,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_10": {
    label: "Před rezervací prosím potvrďte souhlas s…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_11": {
    label: "Čím víc vás přijde, tím méně platí každý.…",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: true,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_12": {
    label: "Vyberte termín v seznamu nebo v kalendáři",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: false,
    maxLength: 200,
  },
  "kurzy.rezervacemodal_13": {
    label: "Nejdřív prosím potvrďte obchodní podmínky.",
    help: "Kde se ukáže: kurzy: RezervaceModal.",
    group: "Kurzy — rezervační okno",
    multiline: false,
    maxLength: 200,
  },
  "account.address_card_1": {
    label: "Opravdu chcete odstranit tuto adresu? Tuto…",
    help: "Kde se ukáže: account: address card.",
    group: "Účet — uložené adresy",
    multiline: true,
    maxLength: 200,
  },
  "account.delete_account_1": {
    label: "Objednávky nám musí zůstat kvůli účetnictví,…",
    help: "Kde se ukáže: account: delete account.",
    group: "Účet — zrušení účtu",
    multiline: true,
    maxLength: 250,
  },
  "account.delete_account_2": {
    label: "Nic se nestane, dokud to nepotvrdíte tímhle…",
    help: "Kde se ukáže: account: delete account.",
    group: "Účet — zrušení účtu",
    multiline: false,
    maxLength: 200,
  },
  "account.profile_password_1": {
    label: "Nové heslo musí mít aspoň 8 znaků.",
    help: "Kde se ukáže: account: profile password.",
    group: "Účet — změna hesla",
    multiline: false,
    maxLength: 200,
  },
  "account.share_button_1": {
    label: "Moje oblíbené · Keramická zahrada",
    help: "Kde se ukáže: account: share button.",
    group: "Účet — sdílení",
    multiline: false,
    maxLength: 200,
  },
  "account.transfer_request_form_1": {
    label: "Nevidíte tu objednávku, kterou hledáte?",
    help: "Kde se ukáže: account: transfer request form.",
    group: "Účet — převod objednávky",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_2": {
    label: "Zadejte prosím platnou e-mailovou adresu.",
    help: "Kde se ukáže: account: forgot password page.",
    group: "Účet — zapomenuté heslo",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_3": {
    label: "Pokud u nás účet s tímhle e-mailem máte,…",
    help: "Kde se ukáže: account: forgot password page.",
    group: "Účet — zapomenuté heslo",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_4": {
    label: "Napište e-mail, na který máte účet. Pošleme…",
    help: "Kde se ukáže: account: forgot password page.",
    group: "Účet — zapomenuté heslo",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_7": {
    label: "Odkaz není celý — otevřete ho prosím z…",
    help: "Kde se ukáže: account: reset password page.",
    group: "Účet — nastavení nového hesla",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_8": {
    label: "Heslo musí mít aspoň 8 znaků.",
    help: "Kde se ukáže: account: reset password page.",
    group: "Účet — nastavení nového hesla",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_9": {
    label: "Nové přístupové údaje · 03",
    help: "Kde se ukáže: account: reset password page.",
    group: "Účet — nastavení nového hesla",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_10": {
    label: "Zvolte si nové heslo a vraťte se ke svým…",
    help: "Kde se ukáže: account: reset password page.",
    group: "Účet — nastavení nového hesla",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_11": {
    label: "Co jste napsali o věcech, které už máte…",
    help: "Kde se ukáže: account: reviews template.",
    group: "Účet — moje recenze",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_12": {
    label: "Tohle jsou jen ukázky. Zmizí, jakmile…",
    help: "Kde se ukáže: account: reviews template.",
    group: "Účet — moje recenze",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_13": {
    label: "Recenzi napíšete u výrobku, který už máte doma.",
    help: "Kde se ukáže: account: reviews template.",
    group: "Účet — moje recenze",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_14": {
    label: "Váš účet · poslední krok",
    help: "Kde se ukáže: account: send email verification again page.",
    group: "Účet — ověření e-mailu znovu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_15": {
    label: "Odkazem si potvrdíte e-mail a rovnou se…",
    help: "Kde se ukáže: account: send email verification again page.",
    group: "Účet — ověření e-mailu znovu",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_16": {
    label: "Nový odkaz je na cestě.",
    help: "Kde se ukáže: account: send email verification again page.",
    group: "Účet — ověření e-mailu znovu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_17": {
    label: "Mrkněte do doručené pošty i do spamu. Někdy…",
    help: "Kde se ukáže: account: send email verification again page.",
    group: "Účet — ověření e-mailu znovu",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_18": {
    label: "Odkaz není celý — zkopírujte ho prosím z…",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_19": {
    label: "Ověřujeme odkaz, chviličku to zabere.",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_20": {
    label: "E-mail je potvrzený. Účet máte hotový.",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_21": {
    label: "S odkazem něco není v pořádku",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_22": {
    label: "Můžete se podívat na objednávky i na uložené…",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_23": {
    label: "Nový e-mail je na cestě.",
    help: "Kde se ukáže: account: verify email page.",
    group: "Účet — ověření e-mailu",
    multiline: false,
    maxLength: 200,
  },
  "account.templates_24": {
    label: "Kousky, které se vám líbí. Zůstanou tu,…",
    help: "Kde se ukáže: account: wishlist template.",
    group: "Účet — oblíbené",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_25": {
    label: "Tohle jsou jen ukázky. Zmizí, jakmile si…",
    help: "Kde se ukáže: account: wishlist template.",
    group: "Účet — oblíbené",
    multiline: true,
    maxLength: 200,
  },
  "account.templates_26": {
    label: "Až vás něco zaujme, klepněte na srdíčko a…",
    help: "Kde se ukáže: account: wishlist template.",
    group: "Účet — oblíbené",
    multiline: false,
    maxLength: 200,
  },
  "products.bundle_actions_1": {
    label: "Ukázka · koupit půjde, až budou napojená data.",
    help: "Kde se ukáže: products: bundle actions.",
    group: "Výrobek — balíček",
    multiline: false,
    maxLength: 200,
  },
  "products.bundle_actions_2": {
    label: "Všechny vybrané kusy přidáme do košíku najednou.",
    help: "Kde se ukáže: products: bundle actions.",
    group: "Výrobek — balíček",
    multiline: false,
    maxLength: 200,
  },
  "products.made_to_order_notice_1": {
    label: "obchodních podmínkách, čl. Výroba na zakázku",
    help: "Kde se ukáže: products: made to order notice.",
    group: "Výrobek — poučení u zakázky",
    multiline: false,
    maxLength: 200,
  },
  "products.product_reviews_1": {
    label: "Doplňte prosím text recenze a hvězdičky.",
    help: "Kde se ukáže: products: product reviews.",
    group: "Výrobek — recenze",
    multiline: false,
    maxLength: 200,
  },
  "products.product_reviews_2": {
    label: "Toto je dočasný designový náhled. Recenze…",
    help: "Kde se ukáže: products: product reviews.",
    group: "Výrobek — recenze",
    multiline: false,
    maxLength: 200,
  },
  "products.product_reviews_3": {
    label: "Recenzi jsme dostali, ještě ji projdeme a…",
    help: "Kde se ukáže: products: product reviews.",
    group: "Výrobek — recenze",
    multiline: false,
    maxLength: 200,
  },
  "products.product_reviews_4": {
    label: "Jak se vám to doma osvědčilo?",
    help: "Kde se ukáže: products: product reviews.",
    group: "Výrobek — recenze",
    multiline: false,
    maxLength: 200,
  },
  "products.details_2": {
    label: "Odvíjí se od velikosti a váhy zásilky.…",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: true,
    maxLength: 200,
  },
  "products.chapter_1": {
    label: "02 · Jak to vzniká",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.chapter_2": {
    label: "Ruce · materiál · čas",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.chapter_3": {
    label: "Od prvního nápadu až po poslední výpal.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.chapter_4": {
    label: "Aby vám to dlouho vydrželo.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.buy_now_1": {
    label: "Doručíme na vaši uloženou adresu.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.price_1": {
    label: "Záznam cen za celých 30 dní před slevou nemáme.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.price_3": {
    label: "Nejnižší cena za 30 dní před slevou:",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.price_4": {
    label: "— v eurech ji přepočteme kurzem ČNB.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.price_5": {
    label: "Balné u tohoto výrobku neúčtujeme.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.details_3": {
    label: "Cena se odvíjí od rozsahu — pošlete nám…",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: true,
    maxLength: 200,
  },
  "products.sold_1": {
    label: "Další kusy ze stejné kolekce.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.sold_2": {
    label: "Další kusy, které mám teď v ateliéru.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "products.sold_3": {
    label: "Všechno vzniká ručně a jen v malém počtu.",
    help: "Kde se ukáže: products: ProductPage.",
    group: "Výrobek — stránka výrobku",
    multiline: false,
    maxLength: 200,
  },
  "checkout.address_select_1": {
    label: "Kam vám to máme poslat?",
    help: "Kde se ukáže: checkout: address select.",
    group: "Pokladna — výběr adresy",
    multiline: false,
    maxLength: 200,
  },
  "checkout.addresses_1": {
    label: "Použijeme stejnou adresu jako pro doručení.",
    help: "Kde se ukáže: checkout: addresses.",
    group: "Pokladna — adresy",
    multiline: false,
    maxLength: 200,
  },
  "checkout.addresses_2": {
    label: "Používáme vaši uloženou adresu — změnit ji…",
    help: "Kde se ukáže: checkout: addresses.",
    group: "Pokladna — adresy",
    multiline: true,
    maxLength: 200,
  },
  "checkout.commission_brief_1": {
    label: "Uloženo — díky, mám to.",
    help: "Kde se ukáže: checkout: commission brief.",
    group: "Pokladna — zadání zakázky",
    multiline: false,
    maxLength: 200,
  },
  "checkout.discount_code_1": {
    label: "Mám slevový kód nebo poukaz",
    help: "Kde se ukáže: checkout: discount code.",
    group: "Pokladna — slevový kód",
    multiline: false,
    maxLength: 200,
  },
  "checkout.order_summary_disclosure_1": {
    label: "slevový kód a dárkový poukaz",
    help: "Kde se ukáže: checkout: order summary disclosure.",
    group: "Pokladna — souhrn objednávky",
    multiline: false,
    maxLength: 200,
  },
  "checkout.payment_1": {
    label: "Zaplatíte doručovateli, až vám zásilku předá",
    help: "Kde se ukáže: checkout: payment.",
    group: "Pokladna — platba",
    multiline: false,
    maxLength: 200,
  },
  "checkout.payment_2": {
    label: "Platit budete bezpečně až v dalším kroku.",
    help: "Kde se ukáže: checkout: payment.",
    group: "Pokladna — platba",
    multiline: false,
    maxLength: 200,
  },
  "checkout.production_payment_mode_1": {
    label: "celá částka, pak už nic neřešíte",
    help: "Kde se ukáže: checkout: production payment mode.",
    group: "Pokladna — záloha u zakázky",
    multiline: false,
    maxLength: 200,
  },
  "checkout.shipping_1": {
    label: "Network error while saving Balíkovna point:",
    help: "Kde se ukáže: checkout: shipping.",
    group: "Pokladna — doručení",
    multiline: false,
    maxLength: 200,
  },
  "checkout.shipping_2": {
    label: "Ještě načítáme mapu výdejních míst, moment…",
    help: "Kde se ukáže: checkout: shipping.",
    group: "Pokladna — doručení",
    multiline: false,
    maxLength: 200,
  },
  "checkout.shipping_address_1": {
    label: "Podle verze obchodu, kterou máte zvolenou",
    help: "Kde se ukáže: checkout: shipping address.",
    group: "Pokladna — dodací adresa",
    multiline: false,
    maxLength: 200,
  },
  "poukaz.poukazdetail_1": {
    label: "V obchodě zadejte kód v košíku nebo v…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 350,
  },
  "poukaz.poukazdetail_2": {
    label: "V dílně stačí poukaz ukázat.",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: false,
    maxLength: 200,
  },
  "poukaz.poukazdetail_3": {
    label: "Platí na keramiku i na zakázky, na kurzy…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_4": {
    label: "Peníze za tenhle poukaz se vrátily, takže ho…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_5": {
    label: "Zrušený poukaz už nejde uplatnit. Pokud si…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_7": {
    label: "Celá hodnota poukazu už byla uplatněna,…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_8": {
    label: "Po konci platnosti už poukaz uplatnit nejde.…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_9": {
    label: "Platba je na cestě, jen se k nám ještě…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 300,
  },
  "poukaz.poukazdetail_10": {
    label: "Někdy to bance trvá déle. Pokud vám peníze z…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 300,
  },
  "poukaz.poukazdetail_12": {
    label: "Peníze se vám nestrhly. Můžete to zkusit…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_14": {
    label: "a posílám ho i e-mailem.",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: false,
    maxLength: 200,
  },
  "poukaz.poukazdetail_15": {
    label: "— vytisknu ho a pošlu poštou.",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: false,
    maxLength: 200,
  },
  "poukaz.poukazdetail_16": {
    label: "Hned po zaplacení vám poukaz přijde e-mailem…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazdetail_17": {
    label: "Po zaplacení poukaz vytisknu a pošlu poštou.…",
    help: "Kde se ukáže: poukaz: PoukazDetail.",
    group: "Poukaz — stránka poukazu",
    multiline: true,
    maxLength: 200,
  },
  "poukaz.poukazkarta_1": {
    label: "V obchodě zadejte kód do pole Slevový kód…",
    help: "Kde se ukáže: poukaz: PoukazKarta.",
    group: "Poukaz — karta poukazu",
    multiline: true,
    maxLength: 350,
  },
  "store.shophero_1": {
    label: "Každý kus dělám rukama. Dva úplně stejné mi…",
    help: "Kde se ukáže: store: Shop.",
    group: "Obchod — výpis výrobků",
    multiline: true,
    maxLength: 200,
  },
  "legal.downloads_1": {
    label: "Doplňkové materiály k dokumentu. Závazné je…",
    help: "Kde se ukáže: legal: Downloads.",
    group: "Dokumenty ke stažení",
    multiline: true,
    maxLength: 200,
  },
  "legal.legaldocument_1": {
    label: "Nebo uložit jako PDF přes tisk v prohlížeči",
    help: "Kde se ukáže: legal: LegalDocument.",
    group: "Právní dokument na webu",
    multiline: false,
    maxLength: 200,
  },
  "certifikaty.certifikaty_1": {
    label: "Certifikáty a protokoly o nezávadnosti glazur",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: false,
    maxLength: 200,
  },
  "certifikaty.certifikaty_2": {
    label: "Keramika, kterou nabízím na jídlo a pití…",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: true,
    maxLength: 500,
  },
  "certifikaty.certifikaty_3": {
    label: "Elektrozařízení nepatří do směsného odpadu —…",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: true,
    maxLength: 200,
  },
  "certifikaty.certifikaty_4": {
    label: "Co to znamená v praxi",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: false,
    maxLength: 200,
  },
  "certifikaty.certifikaty_5": {
    label: "Výrobek bez uvedené nezávadnosti (dekorace,…",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: true,
    maxLength: 200,
  },
  "certifikaty.certifikaty_6": {
    label: "Keramika je křehká: rozbitý kus má ostré…",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: true,
    maxLength: 200,
  },
  "certifikaty.certifikaty_7": {
    label: "V zimě v pítku ani jiné nádobě nenechávejte…",
    help: "Kde se ukáže: certifikaty: index.",
    group: "Certifikáty a protokoly",
    multiline: true,
    maxLength: 200,
  },
  "cart.item_1": {
    label: "Zatím nenastavený — hodnotu a podobu zvolte níž",
    help: "Kde se ukáže: cart: item.",
    group: "Košík — řádek zboží",
    multiline: false,
    maxLength: 200,
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
  "kosik.prazdny":
    "Zatím je prázdný. Podívejte se, co je v ateliéru — třeba vás něco chytne.",
  "kosik.prihlaseni":
    "Přihlaste se a nemusíte znovu vyplňovat adresu.",
  "kosik.baleni":
    "Všechno je dělané rukama. Než to pošleme, pečlivě to v ateliéru zabalíme.",
  "kosik.dobirka_poplatek":
    "Poplatek za dobírku — zmizí, když zvolíte jiný způsob platby.",
  "kosik.platba_zrusena":
    "Platba se nedokončila a nic jsme vám nestrhli.",
  "kosik.platba_zrusena_vyzva":
    "Zaplaťte prosím objednávku, ať ji můžeme co nejdřív poslat — do té doby ji nemáme jak odeslat. Zboží vám v košíku zůstalo, stačí pokračovat.",
  "kosik.platba_ceka_brana":
    "Platba k nám zatím nedorazila. Pokud jste ji na platební bráně nedokončili, dokončete ji tlačítkem níže. Pokud jste posílali převod, nemusíte nic dělat — jakmile peníze dorazí, objednávku dokončíme a pošleme potvrzení e-mailem.",
  "kosik.platba_ceka_prevod":
    "Platbu jsme odeslali, banka ji ale zatím nepotvrdila. U převodu to bývá i pár hodin, o víkendu klidně déle. Nemusíte nic dělat — jakmile ji potvrdíme, napíšeme vám.",
  "kosik.platba_ceka_obnova":
    "Stránka se sama každých pár vteřin obnoví. Klidně ji zavřete, na výsledek to nemá vliv.",
  "kosik.platba_potvrzuje":
    "Ještě chviličku — objednávku potvrzujeme a ukládáme. Stránku nemusíte obnovovat.",
  "pokladna.adresa_vyber":
    "Vyberte si uloženou adresu, nebo vyplňte novou níž.",
  "pokladna.firma_uvod":
    "Fakturační údaje firmy nebo OSVČ. Doklad vystavíme na ně, zboží pošleme na adresu výš.",
  "pokladna.firma_nazev":
    "U firmy název, u OSVČ jméno a příjmení tak, jak jsou v rejstříku.",
  "pokladna.firma_dic":
    "Tvar CZ a osm až deset číslic, například CZ27074358. Neplátce DPH nechá prázdné.",
  "pokladna.doprava_poukaz":
    "Doprava není potřeba — elektronický poukaz pošleme e-mailem.",
  "pokladna.doprava_balikovna_vyber":
    "Vyberte prosím Balíkovnu, kam vám balík pošleme.",
  "pokladna.doprava_vydejni_vyber":
    "Vyberte prosím výdejní místo v mapě.",
  "pokladna.doprava_zmena":
    "Dopravu můžete změnit, dokud objednávku nepotvrdíte.",
  "pokladna.platba_balikovna_karta":
    "Na výdejní místo Balíkovny posíláme jen s platbou předem kartou — zásilku si pak jen vyzvednete. Dobírku nabízíme při doručení na adresu.",
  "zakazka.brief_uvod":
    "Napište, jak si to představujete, a přiložte fotky. Podle toho se to vyrobí — bez zadání nevíme, co máme udělat.",
  "zakazka.brief_kosik":
    "Napište, jak si to představujete, a přiložte fotky. Podle toho to vyrobím.",
  "zakazka.brief_vyzva":
    "Napište prosím pár slov, nebo přiložte fotku.",
  "zakazka.brief_poznamka":
    "Napadlo vás ještě něco? Napište mi a klidně přiložte fotky — čtu to u rozdělané práce.",
  "zakazka.doplatek_recap":
    "Zbytek doplatíte, až bude zakázka hotová. Částku zvolíte v kroku Platba.",
  "zakazka.seznam_uvod":
    "Každá zakázka má svůj stav, zálohu a doplatek — níž po jedné.",
  "objednavka.doplatek_prisel":
    "Platba dorazila, děkuji. Potvrzení vám přijde e-mailem.",
  "objednavka.doplatek_zrusen":
    "Platba se zrušila a nic se nestrhlo. Zkusit to můžete znovu z odkazu v e-mailu, nebo mi napište.",
  "objednavka.doplatek_zpracovava":
    "Platba se ještě zpracovává. Jakmile dorazí, dám vám vědět e-mailem.",
  "objednavka.doplatek_odkaz_neplati":
    "Odkaz na platbu už neplatí. Napište mi prosím a pošlu vám nový.",
  "objednavka.prevzeti_obal":
    "Prohlédněte si prosím obal ještě při převzetí. Je-li promáčklý, protržený nebo něčím prosakuje, rozbalte zásilku před doručovatelem a poškození s ním rovnou sepište — se záznamem pošta reklamaci vyřídí nejsnáz. Podmínkou to ale není: keramika se rozbije tiše a poškození často najdete až doma.",
  "objednavka.prevzeti_stav":
    "Záleží na tom, v jakém stavu dorazila krabice. Poškozený obal je škoda dopravce a hlásí se na poště; rozbitý kus v nepoškozené krabici je na nás.",
  "objednavka.podrobnosti_email":
    "Podrobnosti najdete v e-mailu s potvrzením nebo ve svém účtu.",
  "order.carrier_damage_2":
    "Krabice v pořádku, rozbitý výrobek",
  "order.claim_status_8":
    "Vráceno méně než cena vybraných položek — důvod najdete v protokolu a v e-mailu o vyřízení.",
  "order.commission_conversation_1":
    "Napište mi — čtu to u rozdělané práce.",
  "order.commission_conversation_2":
    "Napadlo vás ještě něco? Napište mi.",
  "order.order_edit_1":
    "K objednávce běží dřívější úprava, která čeká na doplacení rozdílu — do té doby objednávka zůstává, jak byla. Když ji nechcete dokončit, zrušte ji; o změnu se pak domluvíme spolu.",
  "order.order_edit_2":
    "Jiný kus, jiné provedení, něco přidat nebo ubrat? Změny zboží domlouváme osobně — napište, co potřebujete, a Lucie vám zavolá nebo odepíše. Do té doby objednávka zůstává, jak je.",
  "order.order_edit_3":
    "Objednávka už se chystá na cestu — doručení tady změnit nejde. Napište nám a domluvíme se.",
  "order.order_edit_4":
    "Výdejní místo můžete změnit, dokud zásilku nepřipravíme k odeslání.",
  "order.order_edit_5":
    "Doručovací adresu můžete změnit, dokud zásilku nepřipravíme k odeslání.",
  "order.order_edit_6":
    "Objednávku si vyzvednete osobně — doručení tu není co měnit.",
  "order.order_edit_7":
    "Zatím žádná změna. Upravte počet, vyměňte provedení nebo přidejte kus — rozdíl ceny uvidíte tady, ještě než cokoli uložíte.",
  "order.order_edit_8":
    "Víc než 30 změn najednou uložit nejde — nejdřív uložte tyhle.",
  "order.order_edit_9":
    "Přesměrováváme vás na platbu rozdílu…",
  "order.order_edit_10":
    "Víc změn najednou uložit nejde — nejdřív uložte tyhle.",
  "order.order_edit_11":
    "Zabaleno — vyměnit jde jen varianta za stejnou cenu.",
  "order.order_edit_12":
    "Upravit můžete, dokud nezačneme balit.",
  "order.order_edit_13":
    "Úpravu jste uložili, ale rozdíl ještě není zaplacený — do té doby objednávka zůstává, jak byla. Když platbu nedokončíte, úpravu zrušte a můžete ji udělat znovu.",
  "order.order_edit_14":
    "K objednávce běží nedokončená úprava. Když ji nechcete dokončit, zrušte ji a můžete začít znovu.",
  "order.order_edit_15":
    "U dobírky nabízíme jen kusy, které jde poslat na dobírku.",
  "order.order_edit_22":
    "Tohle provedení za váš kus vyměnit nejde — po zabalení jen za stejnou cenu, nebo ho nemáme na počet kusů.",
  "order.order_edit_23":
    "Tohle provedení za váš kus vyměnit nejde — vyberte prosím jiné.",
  "order.order_edit_24":
    "Jen kusy, které jde k objednávce přidat. Rozdíl ceny i poštovné uvidíte v souhrnu úpravy, ještě než cokoli uložíte.",
  "order.order_edit_25":
    "Objednávka je zabalená — vyměnit jde jen za provedení nebo výrobek ve stejné ceně.",
  "order.order_edit_26":
    "Jiné provedení · rozdíl za kus",
  "order.order_edit_27":
    "Jiné provedení teď vybrat nejde. Kdybyste potřebovali něco jiného, napište nám na",
  "order.order_edit_28":
    "Jen za výrobek ve stejné ceně.",
  "order.order_edit_29":
    "Cokoli z obchodu, rozdíl ceny se vyrovná.",
  "order.transfer_actions_1":
    "Objednávka teď patří novému majiteli.",
  "order.transfer_actions_2":
    "Podrobnosti najdete ve svém účtu.",
  "order.transfer_actions_3":
    "S touhle žádostí už nemusíte nic dělat.",
  "order.withdrawal_1":
    "Rozmysleli jste si to? Od smlouvy můžete odstoupit bez udání důvodu už teď — i před doručením. Lhůta 14 dnů poběží od převzetí zboží.",
  "order.withdrawal_2":
    "Od smlouvy můžete odstoupit bez udání důvodu do $",
  "order.templates_6":
    "05 · odstoupení, reklamace a vrácení",
  "order.templates_7":
    "Úprava objednávky čeká na zaplacení rozdílu — dokončete ji, nebo ji zrušte.",
  "order.templates_8":
    "Potřebujete změnit doručovací adresu nebo něco v objednávce? Adresu změníte sami, změnu zboží domluvíme osobně.",
  "order.templates_9":
    "Objednávka je zabalená — vyměnit jde ještě provedení za stejnou cenu.",
  "order.templates_10":
    "Objednávku můžete ještě upravit — počet kusů, provedení, přidat něco z obchodu.",
  "kurzy.accountkurzy_1":
    "Rezervovaná místa v ateliéru — termín, počet lidí a stav platby na jednom místě.",
  "kurzy.accountkurzy_2":
    "Vypsané termíny kurzů najdete na stránce Kurzy — rezervace zabere minutu.",
  "kurzy.rezervacemodal_2":
    "Kurzy probíhají v ateliéru v Písku a rezervují se v korunách, proto je jde rezervovat jen v české verzi obchodu. Přepněte si obchod na Česko — okno rezervace zůstane otevřené.",
  "kurzy.rezervacemodal_3":
    "Ceny se u jednotlivých termínů liší — najdete je u každého termínu.",
  "kurzy.rezervacemodal_4":
    "E-mail a telefon použijeme jen k vyřízení téhle žádosti — nic dalšího na ně posílat nebudeme.",
  "kurzy.rezervacemodal_5":
    "Bezpečně přes ComGate, místo máte jisté hned.",
  "kurzy.rezervacemodal_6":
    "Hotově nebo převodem na účet před začátkem kurzu.",
  "kurzy.rezervacemodal_7":
    "Kurz má pevný termín, proto u něj neplatí zákonné odstoupení do 14 dnů bez udání důvodu (§ 1837 písm. j) občanského zákoníku). Místo něj platí storno podmínky výše.",
  "kurzy.rezervacemodal_8":
    "Souhlasím s pořízením fotografií z kurzu a jejich zveřejněním na webu a sociálních sítích (za dítě souhlasí zákonný zástupce).",
  "kurzy.rezervacemodal_9":
    "Vyberte prosím termín s volnými místy.",
  "kurzy.rezervacemodal_10":
    "Před rezervací prosím potvrďte souhlas s obchodními podmínkami.",
  "kurzy.rezervacemodal_11":
    "Čím víc vás přijde, tím méně platí každý. Cena se spočítá podle počtu osob v dalším kroku.",
  "kurzy.rezervacemodal_12":
    "Vyberte termín v seznamu nebo v kalendáři",
  "kurzy.rezervacemodal_13":
    "Nejdřív prosím potvrďte obchodní podmínky.",
  "account.address_card_1":
    "Opravdu chcete odstranit tuto adresu? Tuto akci nelze vrátit zpět.",
  "account.delete_account_1":
    "Objednávky nám musí zůstat kvůli účetnictví, ale přijdete o svůj profil, adresy, recenze i uložené kousky. Zpátky to už nevrátíme.",
  "account.delete_account_2":
    "Nic se nestane, dokud to nepotvrdíte tímhle tlačítkem.",
  "account.profile_password_1":
    "Nové heslo musí mít aspoň 8 znaků.",
  "account.share_button_1":
    "Moje oblíbené · Keramická zahrada",
  "account.transfer_request_form_1":
    "Nevidíte tu objednávku, kterou hledáte?",
  "account.templates_2":
    "Zadejte prosím platnou e-mailovou adresu.",
  "account.templates_3":
    "Pokud u nás účet s tímhle e-mailem máte, poslali jsme na něj odkaz pro nastavení nového hesla.",
  "account.templates_4":
    "Napište e-mail, na který máte účet. Pošleme vám odkaz pro nastavení nového hesla.",
  "account.templates_7":
    "Odkaz není celý — otevřete ho prosím z e-mailu znovu.",
  "account.templates_8":
    "Heslo musí mít aspoň 8 znaků.",
  "account.templates_9":
    "Nové přístupové údaje · 03",
  "account.templates_10":
    "Zvolte si nové heslo a vraťte se ke svým objednávkám i uloženým kouskům.",
  "account.templates_11":
    "Co jste napsali o věcech, které už máte doma. Ostatním to hodně pomáhá při výběru.",
  "account.templates_12":
    "Tohle jsou jen ukázky. Zmizí, jakmile napíšete první vlastní recenzi.",
  "account.templates_13":
    "Recenzi napíšete u výrobku, který už máte doma.",
  "account.templates_14":
    "Váš účet · poslední krok",
  "account.templates_15":
    "Odkazem si potvrdíte e-mail a rovnou se dostanete do svého účtu.",
  "account.templates_16":
    "Nový odkaz je na cestě.",
  "account.templates_17":
    "Mrkněte do doručené pošty i do spamu. Někdy odkaz dorazí s malým zpožděním.",
  "account.templates_18":
    "Odkaz není celý — zkopírujte ho prosím z e-mailu znovu.",
  "account.templates_19":
    "Ověřujeme odkaz, chviličku to zabere.",
  "account.templates_20":
    "E-mail je potvrzený. Účet máte hotový.",
  "account.templates_21":
    "S odkazem něco není v pořádku",
  "account.templates_22":
    "Můžete se podívat na objednávky i na uložené kousky.",
  "account.templates_23":
    "Nový e-mail je na cestě.",
  "account.templates_24":
    "Kousky, které se vám líbí. Zůstanou tu, dokud se nerozhodnete.",
  "account.templates_25":
    "Tohle jsou jen ukázky. Zmizí, jakmile si uložíte první vlastní kousek.",
  "account.templates_26":
    "Až vás něco zaujme, klepněte na srdíčko a uloží se to sem.",
  "products.bundle_actions_1":
    "Ukázka · koupit půjde, až budou napojená data.",
  "products.bundle_actions_2":
    "Všechny vybrané kusy přidáme do košíku najednou.",
  "products.made_to_order_notice_1":
    "obchodních podmínkách, čl. Výroba na zakázku",
  "products.product_reviews_1":
    "Doplňte prosím text recenze a hvězdičky.",
  "products.product_reviews_2":
    "Toto je dočasný designový náhled. Recenze nebyla odeslána.",
  "products.product_reviews_3":
    "Recenzi jsme dostali, ještě ji projdeme a zveřejníme.",
  "products.product_reviews_4":
    "Jak se vám to doma osvědčilo?",
  "products.details_2":
    "Odvíjí se od velikosti a váhy zásilky. Přesnou částku uvidíte v pokladně ještě před dokončením objednávky.",
  "products.chapter_1":
    "02 · Jak to vzniká",
  "products.chapter_2":
    "Ruce · materiál · čas",
  "products.chapter_3":
    "Od prvního nápadu až po poslední výpal.",
  "products.chapter_4":
    "Aby vám to dlouho vydrželo.",
  "products.buy_now_1":
    "Doručíme na vaši uloženou adresu.",
  "products.price_1":
    "Záznam cen za celých 30 dní před slevou nemáme.",
  "products.price_3":
    "Nejnižší cena za 30 dní před slevou:",
  "products.price_4":
    "— v eurech ji přepočteme kurzem ČNB.",
  "products.price_5":
    "Balné u tohoto výrobku neúčtujeme.",
  "products.details_3":
    "Cena se odvíjí od rozsahu — pošlete nám poptávku a připravíme nabídku s cenou, lhůtou a výší zálohy.",
  "products.sold_1":
    "Další kusy ze stejné kolekce.",
  "products.sold_2":
    "Další kusy, které mám teď v ateliéru.",
  "products.sold_3":
    "Všechno vzniká ručně a jen v malém počtu.",
  "checkout.address_select_1":
    "Kam vám to máme poslat?",
  "checkout.addresses_1":
    "Použijeme stejnou adresu jako pro doručení.",
  "checkout.addresses_2":
    "Používáme vaši uloženou adresu — změnit ji můžete tlačítkem Upravit.",
  "checkout.commission_brief_1":
    "Uloženo — díky, mám to.",
  "checkout.discount_code_1":
    "Mám slevový kód nebo poukaz",
  "checkout.order_summary_disclosure_1":
    "slevový kód a dárkový poukaz",
  "checkout.payment_1":
    "Zaplatíte doručovateli, až vám zásilku předá",
  "checkout.payment_2":
    "Platit budete bezpečně až v dalším kroku.",
  "checkout.production_payment_mode_1":
    "celá částka, pak už nic neřešíte",
  "checkout.shipping_1":
    "Network error while saving Balíkovna point:",
  "checkout.shipping_2":
    "Ještě načítáme mapu výdejních míst, moment…",
  "checkout.shipping_address_1":
    "Podle verze obchodu, kterou máte zvolenou",
  "poukaz.poukazdetail_1":
    "V obchodě zadejte kód v košíku nebo v pokladně do pole Slevový kód nebo dárkový poukaz — částka se odečte hned. Odečítá se ze zboží, které není ve slevě; poštovné doplatíte.",
  "poukaz.poukazdetail_2":
    "V dílně stačí poukaz ukázat.",
  "poukaz.poukazdetail_3":
    "Platí na keramiku i na zakázky, na kurzy zatím ne. Co neutratíte, zůstane na poukazu.",
  "poukaz.poukazdetail_4":
    "Peníze za tenhle poukaz se vrátily, takže ho už nejde uplatnit. Kdyby vám něco nesedělo, napište mi na",
  "poukaz.poukazdetail_5":
    "Zrušený poukaz už nejde uplatnit. Pokud si myslíte, že jde o omyl, ozvěte se mi na",
  "poukaz.poukazdetail_7":
    "Celá hodnota poukazu už byla uplatněna, takže na něm nic nezbývá. Kdyby vám něco nesedělo, napište mi na",
  "poukaz.poukazdetail_8":
    "Po konci platnosti už poukaz uplatnit nejde. Kdybyste se chtěli na cokoli zeptat, ozvěte se mi na",
  "poukaz.poukazdetail_9":
    "Platba je na cestě, jen se k nám ještě nedostala zpráva od banky. Stránka se sama obnoví, jakmile dorazí — nemusíte nic dělat ani platit znovu.",
  "poukaz.poukazdetail_10":
    "Někdy to bance trvá déle. Pokud vám peníze z účtu odešly, neplaťte prosím znovu — zkuste platbu za pár minut zkontrolovat, nebo mi napište na",
  "poukaz.poukazdetail_12":
    "Peníze se vám nestrhly. Můžete to zkusit znovu, nebo mi napište na",
  "poukaz.poukazdetail_14":
    "a posílám ho i e-mailem.",
  "poukaz.poukazdetail_15":
    "— vytisknu ho a pošlu poštou.",
  "poukaz.poukazdetail_16":
    "Hned po zaplacení vám poukaz přijde e-mailem a uvidíte ho i tady, i s kódem.",
  "poukaz.poukazdetail_17":
    "Po zaplacení poukaz vytisknu a pošlu poštou. Kód uvidíte i tady, hned jak platba dorazí.",
  "poukaz.poukazkarta_1":
    "V obchodě zadejte kód do pole Slevový kód nebo dárkový poukaz v košíku, v dílně v Písku stačí poukaz ukázat. Platí na keramiku i na zakázky, na kurzy zatím ne. Co neutratíte, zůstane na poukazu.",
  "store.shophero_1":
    "Každý kus dělám rukama. Dva úplně stejné mi nevyjdou, ani kdybych chtěla.",
  "legal.downloads_1":
    "Doplňkové materiály k dokumentu. Závazné je znění dokumentu výše.",
  "legal.legaldocument_1":
    "Nebo uložit jako PDF přes tisk v prohlížeči",
  "certifikaty.certifikaty_1":
    "Certifikáty a protokoly o nezávadnosti glazur",
  "certifikaty.certifikaty_2":
    "Keramika, kterou nabízím na jídlo a pití nebo u které uvádím „zdravotně nezávadné glazury“, musí splňovat limity pro uvolňování olova a kadmia (nařízení (ES) č. 1935/2004, vyhláška č. 38/2001 Sb.). Tady jsou protokoly ze zkoušek — u každého je datum a glazura, které se týká.",
  "certifikaty.certifikaty_3":
    "Elektrozařízení nepatří do směsného odpadu — vysloužilý zvonek odevzdejte na sběrném místě nebo nám ho vraťte.",
  "certifikaty.certifikaty_4":
    "Co to znamená v praxi",
  "certifikaty.certifikaty_5":
    "Výrobek bez uvedené nezávadnosti (dekorace, výrobky z kurzů) pro jídlo a pití nepoužívejte.",
  "certifikaty.certifikaty_6":
    "Keramika je křehká: rozbitý kus má ostré hrany, střepy ukliďte opatrně a mimo dosah dětí.",
  "certifikaty.certifikaty_7":
    "V zimě v pítku ani jiné nádobě nenechávejte zamrznout vodu — led ji může roztrhnout.",
  "cart.item_1":
    "Zatím nenastavený — hodnotu a podobu zvolte níž",
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
