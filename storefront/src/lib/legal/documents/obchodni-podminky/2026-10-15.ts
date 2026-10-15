import type { LegalDocumentVersion } from "../../types"

/**
 * Obchodní podmínky platné od 15. 10. 2026.
 *
 * Podklad: LEGAL_AUDIT.md §1–8 a checklist „Text" (14. 10. 2026). Zkratky:
 * OZ = zákon č. 89/2012 Sb., občanský zákoník; ZOS = zákon č. 634/1992 Sb.,
 * o ochraně spotřebitele.
 *
 * Kotvy kapitol (`id`) jsou trvalé — odkazují na ně e-maily, FAQ, stránka
 * Kurzy a pokladna. Po vydání je neměnit; nové znění = nový soubor.
 *
 * Datum účinnosti je v textu závěrečných ustanovení napsané i slovy — při
 * přejmenování verze (skutečné datum spuštění) ho změnit i tam.
 */
const obchodniPodminky: LegalDocumentVersion = {
  slug: "obchodni-podminky",
  title: "Obchodní podmínky",
  version: "2026-10-15",
  summary:
    "Jak to mezi námi funguje — objednávka, platba, doprava, vrácení zboží a reklamace, a také zakázky, kurzy a dárkové poukazy.",
  pdf: true,
  sections: [
    {
      id: "prodavajici",
      title: "I. Kdo prodává",
      blocks: [
        {
          type: "p",
          text: "Prodávající je {{seller.name}}, podnikající fyzická osoba se sídlem {{seller.address}}, IČO {{seller.ico}}, zapsaná v živnostenském rejstříku (dále „prodávající“ nebo „my“).",
        },
        { type: "p", text: "Daň z přidané hodnoty: {{vat.status}}." },
        { type: "p", text: "Jak nás zastihnete:" },
        {
          type: "ul",
          items: [
            "e-mail: {{seller.email}}",
            "telefon: {{seller.phone}}",
            "adresa pro dopisy i vracení zboží: {{seller.name}}, {{seller.address}}",
            "internetový obchod: {{seller.web}}",
          ],
        },
      ],
    },
    {
      id: "uvodni-ustanoveni",
      title: "II. Úvodní ustanovení",
      blocks: [
        {
          type: "p",
          text: "Tyto obchodní podmínky (dále „podmínky“) upravují vztah mezi námi a vámi jako kupujícím, když nakupujete v internetovém obchodě {{seller.web}} (dále „obchod“). Platí pro:",
        },
        {
          type: "ul",
          items: [
            "koupi zboží z nabídky obchodu,",
            "koupi zboží vyrobeného na zakázku podle vašeho zadání ([čl. IX](/smluvni-podminky#vyroba-na-zakazku)),",
            "rezervaci keramického kurzu — to je smlouva o poskytnutí služby, ne koupě zboží ([čl. X](/smluvni-podminky#kurzy)),",
            "koupi dárkového poukazu ([čl. XI](/smluvni-podminky#darkove-poukazy)).",
          ],
        },
        {
          type: "p",
          text: "Kupujícím může být **spotřebitel**, tedy člověk, který nakupuje mimo svou podnikatelskou činnost, nebo **podnikatel**, který nakupuje pro své podnikání (například na firmu s IČO). Právo odstoupit od smlouvy do 14 dnů a ustanovení, která výslovně chrání spotřebitele, platí jen pro spotřebitele.",
        },
        {
          type: "p",
          text: "Smlouva se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanským zákoníkem (dále „OZ“), a zákonem č. 634/1992 Sb., o ochraně spotřebitele (dále „ZOS“). Jste-li spotřebitel s obvyklým bydlištěm v jiném členském státě Evropské unie (například na Slovensku), nepřicházíte volbou českého práva o ochranu, kterou vám poskytují kogentní ustanovení práva státu vašeho bydliště.",
        },
        {
          type: "p",
          text: "Smlouvu uzavíráme v češtině. Odchylná ujednání, na kterých se spolu výslovně dohodneme (například v cenové nabídce zakázky), mají přednost před těmito podmínkami.",
        },
        {
          type: "p",
          text: "Podmínky jsou součástí smlouvy. Ve znění platném v den objednávky vám je pošleme v PDF spolu s potvrzením objednávky.",
        },
      ],
    },
    {
      id: "uzivatelsky-ucet",
      title: "III. Zákaznický účet",
      blocks: [
        {
          type: "p",
          text: "Nakupovat můžete s účtem i bez něj. Účet si založíte registrací v obchodě. Přístup je chráněný vaším e-mailem a heslem — heslo nikomu nesdělujte a účet nedávejte k užívání dalším lidem.",
        },
        {
          type: "p",
          text: "V účtu najdete své objednávky a jejich stav, u každé objednávky znění obchodních podmínek, podle kterého se uzavřela, a své rezervace kurzů. U objednávky odtud můžete podat reklamaci nebo odstoupit od smlouvy.",
        },
        {
          type: "p",
          text: "Při registraci a objednávce uvádějte pravdivé údaje a v účtu je aktualizujte, když se změní. Údaje, které uvedete, považujeme za správné.",
        },
        {
          type: "p",
          text: "Účet můžete kdykoli zrušit v jeho nastavení. My ho můžeme zrušit, když ho déle než 3 roky nepoužíváte nebo když hrubě porušíte smlouvu či tyto podmínky — předem vám o tom napíšeme. Zrušením účtu uzavřené smlouvy nezanikají.",
        },
        {
          type: "p",
          text: "Účet nemusí být dostupný nepřetržitě, například kvůli nutné údržbě obchodu.",
        },
      ],
    },
    {
      id: "uzavreni-smlouvy",
      title: "IV. Objednávka a uzavření smlouvy",
      blocks: [
        {
          type: "p",
          text: "Zboží v obchodě nabízíme bez závazku; smlouva vzniká až potvrzením vaší objednávky (viz níže). Ustanovení § 1732 odst. 2 OZ se nepoužije.",
        },
        {
          type: "p",
          text: "Objednávku uděláte v obchodě: výrobky vložíte do košíku, vyplníte kontaktní a doručovací údaje, zvolíte dopravu a platbu a v přehledu uvidíte celou objednávku — zboží, ceny všech položek, dopravu, způsob platby i dodací lhůtu. Než objednávku odešlete, můžete cokoli zkontrolovat a opravit, včetně chyb při zadávání.",
        },
        {
          type: "p",
          text: "Před odesláním potvrdíte, že jste se seznámili s těmito podmínkami a s poučením o odstoupení od smlouvy. Obsahuje-li objednávka zboží na zakázku, potvrdíte také, že berete na vědomí, že od této části smlouvy nelze odstoupit ve 14denní lhůtě ([čl. IX](/smluvni-podminky#vyroba-na-zakazku)).",
        },
        {
          type: "p",
          text: "Objednávku odešlete tlačítkem **„Objednávka zavazující k platbě“**, rezervaci kurzu tlačítkem **„Rezervace zavazující k platbě“**. Odesláním se zavazujete zaplatit.",
        },
        {
          type: "p",
          text: "Odeslaná objednávka je návrhem smlouvy. Jeho přijetí vám bez zbytečného odkladu potvrdíme e-mailem na adresu, kterou jste uvedli. **Doručením tohoto potvrzení je smlouva uzavřena.** K potvrzení přikládáme tyto podmínky v PDF ve znění platném v den objednávky.",
        },
        {
          type: "p",
          text: "Nemůžeme-li objednávku přijmout tak, jak je (například se unikátní kus mezitím prodal), napíšeme vám a navrhneme jiné řešení. Takový návrh je novou nabídkou a smlouva pak vzniká až vaším souhlasem.",
        },
        {
          type: "p",
          text: "Ve výjimečných případech (neobvykle velká objednávka, neobvyklá doprava) vás můžeme požádat o dodatečné potvrzení objednávky e-mailem nebo telefonicky.",
        },
        {
          type: "p",
          text: "Uzavřenou smlouvu archivujeme v elektronické podobě. Najdete ji v potvrzovacím e-mailu (včetně podmínek v PDF), a nakupujete-li s účtem, také v účtu u objednávky. Předchozí znění podmínek zůstávají dostupná na našem webu.",
        },
        {
          type: "p",
          text: "Náklady na internet nebo telefon, které vám při objednávce vzniknou, si hradíte sami; neliší se od vaší běžné sazby.",
        },
        {
          type: "p",
          text: "Nejsme vázáni žádným kodexem chování (§ 1826 odst. 1 písm. e) OZ).",
        },
      ],
    },
    {
      id: "cena-a-platba",
      title: "V. Cena a platba",
      blocks: [
        {
          type: "p",
          text: "Ceny v obchodě jsou konečné — obsahují všechny daně a poplatky. Platí cena zobrazená v okamžiku odeslání objednávky.",
        },
        { type: "p", text: "K ceně výrobků se připočítává:" },
        {
          type: "ul",
          items: [
            "**balné** — samostatná položka u každého výrobku, kterou vidíte v košíku; účtuje se i při osobním odběru,",
            "**cena dopravy** podle zvoleného způsobu doručení,",
            "**doběrečné**, pokud zvolíte platbu na dobírku.",
          ],
        },
        {
          type: "p",
          text: "Všechny tyto částky vidíte v košíku a v přehledu objednávky, ještě než ji odešlete. Aktuální ceny dopravy a doběrečného jsou na stránce [Doprava a platba](/doprava-a-platba).",
        },
        {
          type: "p",
          text: "Na Slovensko prodáváme v eurech. Ceny v eurech odvozujeme od cen v korunách podle kurzu České národní banky; závazná je cena v eurech, kterou vidíte v košíku při objednávce.",
        },
        { type: "p", text: "Zaplatit můžete:" },
        {
          type: "ul",
          items: [
            "**online přes platební bránu ComGate** (ComGate Payments, a.s.) — platební kartou, přes Apple Pay nebo Google Pay, nebo online převodem ze svého internetového bankovnictví; platíte při odeslání objednávky,",
            "**na dobírku** — jen v České republice a jen při doručení Českou poštou na adresu (ne na výdejní místo Balíkovny); u zboží na zakázku a u některých dalších výrobků ji nenabízíme; platíte při převzetí zásilky,",
            "**v hotovosti při osobním odběru** v ateliéru — platíte při vyzvednutí.",
          ],
        },
        {
          type: "p",
          text: "Splátky ani odloženou platbu nenabízíme. Převodem na náš účet {{bank.account}} se platí jen tehdy, když se na tom výslovně domluvíme (například když platba přes bránu opakovaně nejde); jako variabilní symbol uveďte číslo objednávky.",
        },
        {
          type: "p",
          text: "Zálohu požadujeme jen u zboží vyrobeného na zakázku — její výši a placení upravuje [čl. IX](/smluvni-podminky#vyroba-na-zakazku). U ostatního zboží zálohu nevybíráme.",
        },
        {
          type: "p",
          text: "Platíte-li online, je cena splatná při odeslání objednávky; na dobírku a při osobním odběru při převzetí zboží. Platba online je zaplacena, jakmile nám ji platební brána potvrdí.",
        },
        {
          type: "p",
          text: "Vlastnické právo ke zboží nabýváte zaplacením celé ceny, nejdříve však převzetím zboží.",
        },
        {
          type: "p",
          text: "Doklad o zaplacení (fakturu) vám pošleme elektronicky na váš e-mail.",
        },
      ],
    },
    {
      id: "slevy",
      title: "VI. Slevy, akce a kusy s vadou",
      blocks: [
        {
          type: "p",
          text: "**Slevové kódy.** Do jedné objednávky lze uplatnit jeden slevový kód — zadáte-li další, ponecháme ten, který vám ušetří víc. Kódy se nevztahují na zboží, které už je zlevněné, ani na výrobky, které jsme ze slevových kódů vyloučili (sleva se u nich v košíku neodečte). Slevy nelze vyměnit za peníze. Akce, kterou obchod uplatní sám bez kódu, platí za podmínek uvedených u akce.",
        },
        {
          type: "p",
          text: "**Oznámení o slevě.** Když u výrobku uvádíme slevu, uvádíme vždy i předchozí cenu, tedy nejnižší cenu, za kterou jsme výrobek nabízeli během 30 dnů před zavedením slevy (§ 12a ZOS). Od této ceny se sleva počítá. Zvyšujeme-li slevu postupně, je předchozí cenou cena před první slevou.",
        },
        {
          type: "p",
          text: "**Kusy s vadou.** Některé kusy prodáváme levněji proto, že mají vadu — například prasklinku v glazuře nebo odštípnutý okraj; najdete je v kolekci „Poškozené“. U nich nejde o slevu, ale o **cenu kusu s uvedenou vadou**: vadu popíšeme a ukážeme u výrobku, ještě než ho koupíte. Za vadu, pro kterou je kus levnější, neodpovídáme (§ 2167 OZ); za jiné vady ano. I takový kus můžete do 14 dnů vrátit ([čl. VIII](/smluvni-podminky#odstoupeni)).",
        },
      ],
    },
    {
      id: "doprava-a-dodani",
      title: "VII. Doprava a dodání",
      blocks: [
        {
          type: "p",
          text: "Zboží doručujeme do České republiky a na Slovensko, a to Českou poštou — na výdejní místa Balíkovny nebo na adresu. Křehké kusy a zboží na zakázku posíláme jen jako křehký balík Českou poštou na adresu. Zboží si můžete také vyzvednout osobně v ateliéru na adrese {{seller.address}}. Aktuální způsoby a ceny dopravy najdete na stránce [Doprava a platba](/doprava-a-platba) a v pokladně.",
        },
        {
          type: "p",
          text: "Zboží skladem předáváme dopravci zpravidla do 2 pracovních dnů od přijetí platby (u dobírky od objednávky). Doručení pak obvykle trvá 1 až 3 pracovní dny. U zboží na zakázku platí výrobní lhůta uvedená u výrobku nebo v nabídce ([čl. IX](/smluvni-podminky#vyroba-na-zakazku)). Není-li dodací lhůta ujednána, dodáme zboží bez zbytečného odkladu, nejpozději do 30 dnů od uzavření smlouvy.",
        },
        {
          type: "p",
          text: "Jakmile zásilku odešleme, pošleme vám e-mail. Osobní odběr si s vámi domluvíme, až bude zboží připravené.",
        },
        {
          type: "p",
          text: "**Nebezpečí škody na zboží přechází na vás až převzetím zásilky.** Za to, že zboží dorazí v pořádku, odpovídáme my.",
        },
        {
          type: "p",
          text: "**Kontrola při převzetí je prosba, ne podmínka.** Zásilku si prosím prohlédněte hned při převzetí. Je-li obal zjevně poškozený, můžete ji nepřevzít, nebo ji rozbalit před doručovatelem a poškození s ním zapsat. Vaše práva tím nijak nepodmiňujeme.",
        },
        {
          type: "p",
          text: "**Poškození při přepravě.** Dorazí-li zboží rozbité nebo poškozené, napište nám — nejlépe s fotografiemi obalu i obsahu. Jde o vadu zboží při převzetí a vyřídíme ji jako reklamaci ([čl. XII](/smluvni-podminky#prava-z-vadneho-plneni)). U České pošty nic reklamovat nemusíte; škodu s dopravcem řešíme my.",
        },
        {
          type: "p",
          text: "Musíme-li zásilku z důvodů na vaší straně doručovat opakovaně nebo jinak, než jste v objednávce zvolili (například když si ji bez důvodu nevyzvednete), uhradíte náklady, které nám tím vzniknou.",
        },
      ],
    },
    {
      id: "odstoupeni",
      title: "VIII. Odstoupení od smlouvy",
      blocks: [
        {
          type: "p",
          text: "Jste-li spotřebitel, můžete od kupní smlouvy uzavřené přes obchod odstoupit bez udání důvodu **do 14 dnů od převzetí zboží** (§ 1829 OZ). Doručujeme-li objednávku po částech, běží lhůta od převzetí poslední části. Lhůta je zachována, odešlete-li odstoupení před jejím uplynutím. Vzorové poučení a formulář najdete na stránce [Odstoupení od smlouvy](/odstoupeni-od-smlouvy).",
        },
        {
          type: "p",
          text: "Odstoupit můžete jakýmkoli jednoznačným prohlášením, například:",
        },
        {
          type: "ul",
          items: [
            "online tlačítkem **„Odstoupit od smlouvy“** u objednávky v zákaznickém účtu, nebo přes odkaz v e-mailu o odeslání objednávky — po kontrole předvyplněných údajů odstoupení potvrdíte tlačítkem **„Potvrdit odstoupení od smlouvy“**,",
            "e-mailem na {{seller.email}},",
            "dopisem na adresu {{seller.name}}, {{seller.address}}.",
          ],
        },
        {
          type: "p",
          text: "Vzorový formulář použít můžete, ale nemusíte. Přijetí odstoupení vám bez zbytečného odkladu potvrdíme e-mailem; u odstoupení online včetně jeho obsahu a data a času odeslání.",
        },
        {
          type: "p",
          text: "Zboží nám do 14 dnů od odstoupení pošlete zpět nebo předejte na adrese {{seller.name}}, {{seller.address}}; stačí ho v této lhůtě odeslat. Zboží sami nevyzvedáváme.",
        },
        {
          type: "p",
          text: "**Přímé náklady na vrácení zboží nesete vy.** Keramika se vrací pečlivě zabalená, nejlépe v původním obalu a jako křehký balík; počítejte s náklady přibližně {{withdrawal.returnCostEstimate}}. Za poškození zboží při cestě zpět odpovídáte jako odesílatel, proto doporučujeme zásilku pojistit. Zásilku na dobírku převzít nemůžeme.",
        },
        {
          type: "p",
          text: "**Peníze vám vrátíme do 14 dnů** ode dne, kdy nám odstoupení došlo: všechny peníze, které jsme od vás podle smlouvy přijali, včetně nákladů na dodání ve výši nejlevnějšího způsobu dodání, který nabízíme (§ 1832 OZ). Zvolili-li jste dražší způsob dodání, rozdíl nevracíme.",
        },
        {
          type: "p",
          text: "Vracíme stejným způsobem, jakým jste platili — platbu kartou, přes Apple Pay, Google Pay nebo online převodem vrátíme přes bránu ComGate tam, odkud přišla. Jiným způsobem jen s vaším souhlasem a bez dalších nákladů pro vás. Platili-li jste na dobírku nebo v hotovosti při odběru, pošleme peníze převodem na účet, který nám uvedete. Peníze můžeme vrátit až poté, co nám zboží dojde nebo co prokážete, že jste ho odeslali — podle toho, co nastane dříve.",
        },
        {
          type: "p",
          text: "Odpovídáte jen za snížení hodnoty zboží, které vzniklo tím, že jste se zbožím zacházeli jinak, než je nutné k seznámení s jeho povahou, vlastnostmi a funkčností (§ 1833 OZ). Vznikne-li nám takový nárok, předem vám ho vyčíslíme a zdůvodníme; můžeme ho započíst proti vracené částce.",
        },
        { type: "p", text: "**Kdy odstoupit nelze** (§ 1837 OZ):" },
        {
          type: "ul",
          items: [
            "u **zboží vyrobeného podle vašich požadavků nebo přizpůsobeného vašim osobním potřebám** (písm. d) — zboží na zakázku podle [čl. IX](/smluvni-podminky#vyroba-na-zakazku), například domovní číslo nebo znamení s vaším textem či motivem, výrobek se jménem, reliéf podle zadání nebo rozměr na míru. Pouhý výběr barvy, velikosti nebo glazury z nabízených variant takovou úpravou není — takový výrobek vrátit můžete;",
            "u **kurzu s pevným termínem**, protože jde o službu spojenou s využitím volného času poskytovanou v určitém termínu (písm. j). Místo odstoupení platí storno podmínky v [čl. X](/smluvni-podminky#kurzy).",
          ],
        },
        {
          type: "p",
          text: "Na tyto výjimky vás upozorníme u výrobku či kurzu a znovu před odesláním objednávky nebo rezervace.",
        },
        {
          type: "p",
          text: "Odstoupit můžete i od koupě kusu s vadou nebo zlevněného zboží (vracíme cenu, kterou jste skutečně zaplatili) a od koupě dárkového poukazu, dokud nebyl uplatněn ([čl. XI](/smluvni-podminky#darkove-poukazy)). Obsahuje-li objednávka běžné zboží i zboží na zakázku, můžete odstoupit od části s běžným zbožím.",
        },
        {
          type: "p",
          text: "**Kdy můžeme od smlouvy odstoupit my.** Jen tehdy, když a) je zboží vyprodané — typicky se jediný kus mezitím prodal a jiný stejný nemáme, b) není k dispozici materiál nutný k výrobě, nebo c) je v obchodě zjevná chyba v ceně. Dáme vám hned vědět a všechny přijaté peníze vrátíme bez zbytečného odkladu, nejpozději do 14 dnů, stejným způsobem, jakým jste platili.",
        },
        {
          type: "p",
          text: "Podnikatel, který nakupuje pro své podnikání, právo odstoupit podle tohoto článku nemá.",
        },
      ],
    },
    {
      id: "vyroba-na-zakazku",
      title: "IX. Výroba na zakázku",
      blocks: [
        {
          type: "p",
          text: "**Co je zakázka.** Zbožím na zakázku je výrobek vyrobený podle vašich individuálních požadavků nebo upravený pro vaši osobu — zejména domovní čísla a znamení s konkrétním textem či motivem, výrobky se jménem, rozměry na míru a reliéfy podle zadání. V obchodě je takové zboží označené jako zakázka. Výběr barvy, velikosti nebo glazury z nabízených variant zakázkou není.",
        },
        { type: "p", text: "**Jak zakázka vzniká.**" },
        {
          type: "ul",
          items: [
            "**Zakázkový výrobek z obchodu:** objednáte ho jako jiné zboží a v pokladně vyplníte zadání (text, číslo, motiv, případně fotografie). Smlouva vzniká potvrzením objednávky ([čl. IV](/smluvni-podminky#uzavreni-smlouvy)).",
            "**Zakázka podle poptávky:** pošlete nám poptávku přes formulář na stránce [Výroba](/vyroba) nebo e-mailem. Pošleme vám nabídku s popisem nebo náčrtem, cenou, výrobní lhůtou a výší zálohy. Smlouva vzniká, když nabídku potvrdíte nebo zaplatíte zálohu — podle toho, co nastane dříve.",
          ],
        },
        {
          type: "p",
          text: "**Postup.** Zadání si přečteme a potvrdíme vám ho e-mailem. Je-li potřeba něco upřesnit, nebo nejde-li zadání vyrobit tak, jak je popsané, ozveme se dřív, než začneme; nedomluvíme-li se, od smlouvy odstoupíme a zálohu vrátíme celou. Výroba začíná po potvrzení zadání a zaplacení zálohy — o zahájení vám pošleme e-mail. Před konečným výpalem vám pošleme fotografii výrobku ke schválení. Po dokončení vás vyzveme k doplatku a po jeho zaplacení zakázku odešleme nebo předáme.",
        },
        {
          type: "p",
          text: "**Záloha.** Při objednávce zaplatíte zálohu ve výši {{mto.deposit}} ceny výrobku (u zakázky podle poptávky ve výši uvedené v nabídce), nejvýše však 50 % ceny. Zálohu platíte předem online přes platební bránu ComGate, i když si zakázku vyzvednete osobně. Zaplatit můžete i víc, třeba celou cenu najednou. Záloha se počítá jen z ceny zboží; dopravu zaplatíte s doplatkem. Za zálohu i za doplatek dostanete samostatný doklad.",
        },
        {
          type: "p",
          text: "**Bez práva odstoupit do 14 dnů.** Berete na vědomí, že od smlouvy o zboží na zakázku **nemůžete odstoupit ve 14denní lhůtě** podle § 1829 OZ, protože jde o zboží vyrobené podle vašich požadavků nebo přizpůsobené vašim osobním potřebám (§ 1837 písm. d) OZ). Upozorníme vás na to u výrobku a vy to před odesláním objednávky potvrdíte.",
        },
        {
          type: "p",
          text: "**Schválení podoby.** Před konečným výpalem vám e-mailem pošleme fotografii rozpracovaného výrobku. Schválením se tato podoba stává smluvenou předlohou. Drobné úpravy, které ještě jdou udělat, s vámi rádi probereme. Nevyjádříte-li se k fotografii do 5 pracovních dnů, považujeme podobu za schválenou — na tuto lhůtu vás v e-mailu upozorníme.",
        },
        {
          type: "p",
          text: "**Zrušení zakázky z vaší strany.** Zrušíte-li zakázku dřív, než začneme vyrábět, vrátíme zálohu celou. Zrušíte-li ji po zahájení výroby, ponecháme si ze zálohy jen částku odpovídající nákladům skutečně vynaloženým do dne zrušení (materiál, práce, výpal) — vyčíslíme vám je — a zbytek vrátíme do 14 dnů.",
        },
        {
          type: "p",
          text: "**Doplatek.** Po dokončení vám pošleme výzvu k doplacení zbytku ceny včetně dopravy s odkazem na online platbu; při osobním odběru můžete doplatit i na místě. Nezaplatíte-li doplatek ani po připomenutí do 30 dnů od výzvy, můžeme od smlouvy odstoupit a ponechat si ze zálohy náklady skutečně vynaložené na výrobu, nejvýše však celou zálohu.",
        },
        {
          type: "p",
          text: "**Změna zadání.** Změní-li se zadání na vaši žádost tak, že to znamená víc práce nebo materiálu, domluvíme se na příplatku předem. Bez vašeho souhlasu cenu nezvýšíme.",
        },
        {
          type: "p",
          text: "**Výrobní lhůta.** Výrobní lhůtu uvádíme u výrobku nebo v nabídce; ruční výroba se sušením a dvěma výpaly se nedá uspěchat. Kdyby se výroba zpozdila (například kus praskne při výpalu a musí vzniknout znovu), dáme vám hned vědět a navrhneme nový termín. Nebude-li vám vyhovovat, můžete od smlouvy odstoupit a zálohu vám vrátíme celou.",
        },
        {
          type: "p",
          text: "**Odchylky ruční výroby.** Ruční výroba přináší drobné odchylky v odstínu glazury, struktuře povrchu a rozměrech (rozměr nejvýše o 5 % větší nebo menší, není-li sjednáno jinak). Tyto odchylky nejsou vadou. Vadou je rozpor se schválenou předlohou nebo poškození výrobku.",
        },
        {
          type: "p",
          text: "**Doprava.** Zakázky posíláme jako křehký balík Českou poštou na adresu, nebo si je vyzvednete osobně.",
        },
        {
          type: "p",
          text: "Práva z vadného plnění se u zakázky řídí [čl. XII](/smluvni-podminky#prava-z-vadneho-plneni).",
        },
      ],
    },
    {
      id: "kurzy",
      title: "X. Keramické kurzy",
      blocks: [
        {
          type: "p",
          text: "Rezervací kurzu uzavíráte smlouvu o poskytnutí služby — účasti na kurzu v uvedeném termínu. Termíny, ceny a volná místa jsou na stránce [Kurzy](/kurzy). Rezervaci odešlete tlačítkem **„Rezervace zavazující k platbě“** a potvrdíme ji e-mailem; doručením potvrzení je smlouva uzavřena.",
        },
        {
          type: "p",
          text: "Kurz zaplatíte předem online, nebo na místě v den kurzu. Zvolíte-li platbu online a nezaplatíte do 24 hodin, rezervace propadne a místo se uvolní.",
        },
        {
          type: "box",
          title: "Od rezervace kurzu nelze odstoupit do 14 dnů",
          blocks: [
            {
              type: "p",
              text: "Kurz je služba spojená s využitím volného času poskytovaná v určitém termínu. U takové služby zákon právo spotřebitele odstoupit od smlouvy bez udání důvodu vylučuje (§ 1837 písm. j) OZ). Upozorníme vás na to i před odesláním rezervace. Místo odstoupení platí storno podmínky níže.",
            },
          ],
        },
        { type: "p", text: "**Storno podmínky:** {{course.cancellation}}" },
        {
          type: "p",
          text: "Zrušení rezervace nám oznamte e-mailem na {{seller.email}} nebo telefonicky na {{seller.phone}}; nabízí-li to rezervace ve vašem zákaznickém účtu, můžete ji zrušit i tam.",
        },
        {
          type: "p",
          text: "**Když kurz zrušíme my** (například kvůli nemoci nebo malému počtu přihlášených), dáme vám co nejdřív vědět a vrátíme celou zaplacenou částku, nebo vám — budete-li chtít — nabídneme náhradní termín.",
        },
        {
          type: "p",
          text: "**Děti.** Rezervaci za dítě dělá jeho zákonný zástupce. Minimální věk dítěte: {{course.minAge}}. Během vedené práce na kurzu na děti dohlížíme; mimo ni (příchod, přestávky, odchod) za dítě odpovídá rodič nebo osoba, kterou pověří.",
        },
        {
          type: "p",
          text: "**Výrobky z kurzu.** Výrobky po kurzu dohotovíme (vysušíme a vypálíme) a vyzvednete si je v ateliéru do {{course.pickupDeadline}}. Hlína je živý materiál: výrobek může při sušení nebo výpalu prasknout, zvlášť je-li hodně silný nebo je v něm uzavřený vzduch. Za takové poškození neodpovídáme, ledaže bychom ho způsobili my; když se to stane, ozveme se a domluvíme se, co dál.",
        },
        {
          type: "p",
          text: "**Fotografie.** Fotografie z kurzu, na kterých jste vy nebo vaše dítě, zveřejníme (na webu nebo na sociálních sítích) jen s vaším souhlasem; za dítě dává souhlas rodič. Souhlas můžete kdykoli odvolat.",
        },
        {
          type: "p",
          text: "Kurzy pro skupiny, školy a firmy domlouváme individuálně; jejich podmínky jsou v naší nabídce.",
        },
      ],
    },
    {
      id: "darkove-poukazy",
      title: "XI. Dárkové poukazy",
      blocks: [
        {
          type: "p",
          text: "Dárkový poukaz kupujete v obchodě jako běžný výrobek. Jeho hodnota je uvedena na poukazu.",
        },
        {
          type: "p",
          text: "**Platnost:** {{voucher.validity}} od data nákupu; datum konce platnosti je uvedené na poukazu. Po uplynutí platnosti poukaz nelze uplatnit a jeho hodnota se nevrací.",
        },
        {
          type: "p",
          text: "**Uplatnění:** [[DOPLNIT: jak se poukaz uplatňuje (kód v košíku, domluva e-mailem apod.) a na co (zboží, kurzy)]]. [[DOPLNIT: lze poukazem zaplatit zálohu nebo doplatek zakázky?]]",
        },
        {
          type: "p",
          text: "Poukaz nelze vyměnit za hotovost. Na koupi poukazu nelze uplatnit slevový kód ani akci.",
        },
        {
          type: "p",
          text: "Je-li nákup dražší než hodnota poukazu, rozdíl doplatíte. Je-li levnější: {{voucher.remainder}}.",
        },
        {
          type: "p",
          text: "**Odstoupení:** od koupě poukazu můžete odstoupit do 14 dnů ode dne, kdy jste ho obdrželi, pokud ještě nebyl uplatněn — ani zčásti. Po uplatnění už odstoupit nelze.",
        },
        {
          type: "p",
          text: "Odstoupíte-li od nákupu, který jste zaplatili poukazem, vrátíme vám jeho hodnotu stejnou formou — poukazem se stejnou platností, nedohodneme-li se jinak.",
        },
      ],
    },
    {
      id: "prava-z-vadneho-plneni",
      title: "XII. Práva z vadného plnění (reklamace)",
      blocks: [
        {
          type: "p",
          text: "Odpovídáme za to, že zboží při převzetí nemá vady (§ 2161 OZ). Zejména odpovídáme, že zboží:",
        },
        {
          type: "ul",
          items: [
            "odpovídá popisu, druhu, množství, jakosti a dalším vlastnostem, které jsme ujednali nebo které jsme u výrobku uvedli, i v reklamě,",
            "hodí se k účelu, ke kterému jsme ho nabízeli nebo ke kterému se zboží tohoto druhu obvykle používá, a k účelu, který jste nám sdělili a se kterým jsme souhlasili,",
            "je dodáno s příslušenstvím a pokyny k užívání, pokud k němu patří,",
            "u zakázky odpovídá schválené předloze ([čl. IX](/smluvni-podminky#vyroba-na-zakazku)).",
          ],
        },
        {
          type: "p",
          text: "Vadu, která se projeví **do 2 let od převzetí**, můžete reklamovat (§ 2165 OZ). Projeví-li se vada **do 1 roku od převzetí**, má se za to, že zboží bylo vadné už při převzetí, ledaže to povaha zboží nebo vady vylučuje (§ 2161 odst. 5 OZ).",
        },
        {
          type: "p",
          text: "**Co není vadou.** Každý kus je ruční práce. Vadou proto nejsou drobné rozdíly v odstínu a kresbě glazury, ve struktuře povrchu a v tvaru, ani rozměr v toleranci uvedené u výrobku (například „tolerance –3 cm“); u zakázek platí tolerance podle [čl. IX](/smluvni-podminky#vyroba-na-zakazku). Vadou dále není:",
        },
        {
          type: "ul",
          items: [
            "opotřebení způsobené obvyklým užíváním,",
            "poškození vzniklé po převzetí nesprávným zacházením nebo užíváním v rozporu s pokyny — například prasklina pítka nebo jiné nádoby na vodu, ve které v zimě zamrzla voda, pokud jsme vás na nebezpečí mrazu upozornili u výrobku a na kartičce přiložené k zásilce,",
            "vada, pro kterou jsme kus prodali za nižší cenu ([čl. VI](/smluvni-podminky#slevy)).",
          ],
        },
        {
          type: "p",
          text: "**Vaše práva** (§ 2169 až 2171 OZ). Má-li zboží vadu, můžete požadovat opravu, nebo výměnu za nový kus. Nejde-li to — u unikátních kusů výměna často možná není — nebo by to bylo nepřiměřené, můžete požadovat přiměřenou slevu, nebo od smlouvy odstoupit. Slevu nebo odstoupení můžete požadovat také tehdy, když:",
        },
        {
          type: "ul",
          items: [
            "jsme opravu nebo výměnu odmítli, nebo ji neprovedli v přiměřené lhůtě,",
            "se vada projeví opakovaně,",
            "je vada podstatným porušením smlouvy,",
            "je z našeho prohlášení nebo z okolností zřejmé, že vadu neodstraníme v přiměřené době nebo bez značných obtíží pro vás.",
          ],
        },
        {
          type: "p",
          text: "Je-li vada nevýznamná, od smlouvy odstoupit nelze; na přiměřenou slevu ale máte právo.",
        },
        {
          type: "p",
          text: "**Jak reklamaci uplatnit.** Napište nám na {{seller.email}}, podejte reklamaci online u objednávky (v zákaznickém účtu nebo přes odkaz z e-mailu k objednávce), pošlete dopis na {{seller.name}}, {{seller.address}}, nebo přijďte po domluvě do ateliéru. Popište vadu a připojte fotografie, pokud můžete. **Reklamace je uplatněna okamžikem, kdy nám ji oznámíte** — například odesláním e-mailu; nezáleží na tom, kdy k nám dorazí zboží. Zboží nám posílejte, až se domluvíme, jestli je to potřeba — často stačí fotografie.",
        },
        {
          type: "p",
          text: "Přijetí reklamace vám **potvrdíme e-mailem**: kdy jste ji uplatnili, co je jejím obsahem a jaký způsob vyřízení požadujete. Reklamaci vyřídíme **do 30 dnů od uplatnění**, včetně odstranění vady, nedohodneme-li se na delší lhůtě; jinak můžete od smlouvy odstoupit nebo požadovat přiměřenou slevu. O vyřízení vám pošleme potvrzení s datem a způsobem vyřízení, případně se zdůvodněním zamítnutí (§ 19 ZOS).",
        },
        {
          type: "p",
          text: "Při oprávněné reklamaci vám uhradíme účelně vynaložené náklady, zejména poštovné za zaslání zboží k nám.",
        },
        {
          type: "p",
          text: "Podrobnosti najdete v [Reklamačním řádu](/reklamacni-rad), praktický návod a formulář v [Reklamačním protokolu](/reklamacni-protokol).",
        },
        {
          type: "p",
          text: "Kupující podnikatel uplatňuje práva z vadného plnění podle § 2099 až 2117 OZ; vadu musí oznámit bez zbytečného odkladu poté, co ji mohl při dostatečné péči zjistit.",
        },
      ],
    },
    {
      id: "recenze",
      title: "XIII. Recenze",
      blocks: [
        {
          type: "p",
          text: "Recenzi výrobku může napsat přihlášený zákazník. Štítek **„ověřený nákup“** má jen recenze, jejíž autor si výrobek u nás koupil — má nezrušenou objednávku s tímto výrobkem ve svém zákaznickém účtu nebo na stejný, ověřený e-mail. Ověřujeme to automaticky při odeslání recenze. Ostatní recenze ověřené nejsou a štítek nemají.",
        },
        {
          type: "p",
          text: "Recenze ručně moderujeme. Negativní recenze nemažeme ani neupravujeme. Nezveřejníme nebo odstraníme jen recenzi, která je protiprávní nebo vulgární, netýká se výrobku nebo obsahuje osobní údaje dalších lidí.",
        },
      ],
    },
    {
      id: "osobni-udaje",
      title: "XIV. Osobní údaje a obchodní sdělení",
      blocks: [
        {
          type: "p",
          text: "Osobní údaje zpracováváme podle nařízení (EU) 2016/679 (GDPR) a zákona č. 110/2019 Sb. Co zpracováváme, proč, jak dlouho a jaká máte práva, popisují [Zásady ochrany osobních údajů](/ochrana-osobnich-udaju).",
        },
        {
          type: "p",
          text: "Novinky a nabídky (obchodní sdělení) vám posíláme jen tehdy, když se k jejich odběru sami přihlásíte a přihlášení potvrdíte v e-mailu. Odhlásit se můžete kdykoli odkazem v každém z nich. Žádný souhlas za vás předem nezaškrtáváme.",
        },
      ],
    },
    {
      id: "reseni-sporu",
      title: "XV. Stížnosti a mimosoudní řešení sporů",
      blocks: [
        {
          type: "p",
          text: "Stížnosti a podněty nám pište na {{seller.email}}. O vyřízení vám napíšeme na váš e-mail.",
        },
        {
          type: "p",
          text: "Jste-li spotřebitel a nedomluvíme-li se, můžete podat návrh na mimosoudní řešení spotřebitelského sporu (§ 14 ZOS). Příslušným subjektem je **Česká obchodní inspekce**, Štěpánská 796/44, 110 00 Praha 1, [adr.coi.cz](https://adr.coi.cz). Návrh lze podat nejpozději do 1 roku ode dne, kdy jste u nás právo, o které jde, poprvé uplatnili.",
        },
        {
          type: "p",
          text: "Spotřebitelé z jiných zemí Evropské unie (například ze Slovenska) mohou s přeshraničním sporem požádat o pomoc také Evropské spotřebitelské centrum ČR ([evropskyspotrebitel.cz](https://www.evropskyspotrebitel.cz)).",
        },
        {
          type: "p",
          text: "Dozor: dodržování zákona o ochraně spotřebitele kontroluje Česká obchodní inspekce ([coi.cz](https://www.coi.cz)), živnostenskou kontrolu provádí příslušný živnostenský úřad a dozor nad ochranou osobních údajů vykonává Úřad pro ochranu osobních údajů ([uoou.gov.cz](https://uoou.gov.cz)).",
        },
      ],
    },
    {
      id: "dorucovani",
      title: "XVI. Doručování",
      blocks: [
        {
          type: "p",
          text: "Spolu komunikujeme hlavně e-mailem — na adresu, kterou jste uvedli v objednávce nebo v účtu, a na naši adresu {{seller.email}}. **E-mail je platnou formou pro všechna oznámení podle smlouvy**, včetně odstoupení od smlouvy a reklamace. Dopisy posílejte na {{seller.name}}, {{seller.address}}.",
        },
        {
          type: "p",
          text: "Oznámení je doručeno, jakmile dojde do e-mailové schránky nebo je dopis doručen. Odstoupení od smlouvy je včas, odešlete-li ho ve lhůtě.",
        },
      ],
    },
    {
      id: "zaverecna-ustanoveni",
      title: "XVII. Závěrečná ustanovení",
      blocks: [
        {
          type: "p",
          text: "Tyto obchodní podmínky jsou účinné od 15. 10. 2026 a vztahují se na smlouvy uzavřené od tohoto dne. Smlouva uzavřená dříve se řídí zněním, které platilo v den objednávky.",
        },
        {
          type: "p",
          text: "Podmínky můžeme měnit. Nové znění zveřejníme na webu s datem účinnosti; na smlouvy už uzavřené změna nemá vliv. Předchozí znění zůstávají dostupná na vlastních adresách — například [obchodní podmínky platné od 1. 1. 2015](/smluvni-podminky/2015-01-01).",
        },
        {
          type: "p",
          text: "Je-li některé ustanovení neplatné nebo neúčinné, ostatní ustanovení platí dál a místo neplatného se použije příslušné ustanovení zákona.",
        },
        { type: "p", text: "Smlouvu lze měnit dohodou; stačí i e-mailem." },
      ],
    },
  ],
}

export default obchodniPodminky
