/**
 * Texty obchodu — záloha pro případ, že se nedají načíst z backendu.
 *
 * ## Kdo je zdroj pravdy
 *
 * Backend (`backend/src/lib/shop-texty.ts`). Majitelka je upravuje
 * v administraci → Právní věci a texty → Texty obchodu a web si je bere
 * z `GET /store/texty`. Tenhle soubor je jen záloha: když dotaz selže,
 * nebo komponenta stojí mimo poskytovatele, ukáže se tohle znění.
 *
 * Obsah se NEPÍŠE ručně — generuje se z katalogu backendu
 * (scratchpad/generuj-texty-zalohu.js), aby se obě kopie nemohly rozejít
 * překlepem. Že jsou stejné, hlídá navíc test
 * `backend/src/lib/__tests__/shop-texty.unit.spec.ts`.
 *
 * Nepoužívat přímo. Komponenty berou texty z `useTexty()`, které tohle
 * doplní tím, co přišlo z backendu. Prázdná věta znamená „neukazovat" —
 * buď ji majitelka vymazala, nebo vypnula přepínačem.
 */

export const TEXTY_DEFAULTS = {
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
    "Objednávku můžete ještě upravit — počet kusů, provedení, přidat něco z obchodu.",} as const

export type ShopTextKey = keyof typeof TEXTY_DEFAULTS
export type ShopTexty = Record<ShopTextKey, string>

/**
 * Dosadí za značky skutečné hodnoty. Co se nedodá, zůstane nenahrazené —
 * raději ať je ve větě vidět `{{dny}}`, než aby tiše tvrdila nesmysl.
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
