import type { LegalDocumentVersion } from "../../types"

/**
 * Obchodní podmínky platné od 1. 1. 2015 — ARCHIV.
 *
 * Doslovné znění, které obchod zobrazoval do nasazení verze 2026-10-15
 * (dřív `smluvni-podminky/data.ts` + `supplements` v `page.tsx`, vykreslené
 * v tomto pořadí: odstavce → odrážky → doplňkové odstavce). Zůstává kvůli
 * objednávkám, které se podle něj uzavíraly.
 *
 * NEOPRAVOVAT — ani zjevné chyby (prázdný název tlačítka v čl. III, prázdný
 * e-mail v čl. VIII, „šest měsíců" v čl. VII). Je to záznam toho, co platilo;
 * opravené znění je nová verze.
 */
const obchodniPodminky2015: LegalDocumentVersion = {
  slug: "obchodni-podminky",
  title: "Obchodní podmínky",
  version: "2015-01-01",
  summary:
    "Původní znění obchodních podmínek. Zůstává tu pro objednávky, které se podle něj uzavíraly.",
  pdf: true,
  archived: true,
  sections: [
    {
      id: "uvodni-ustanoveni",
      title: "I. ÚVODNÍ USTANOVENÍ",
      blocks: [
        {
          type: "p",
          text: "Tyto obchodní podmínky (dále jen „obchodní podmínky“) obchodní společnosti Lucie Polanská, se sídlem Putim 229, 397 01 Písek, identifikační číslo: 03441482 (dále jen „prodávající“) upravují souladu s ustanovením § 1751 odst. 1 zákona č. 89/2012 Sb., občanský zákoník (dále jen „občanský zákoník“) vzájemná práva a povinnosti smluvních stran vzniklé v souvislosti nebo na základě kupní smlouvy (dále jen „kupní smlouva“) uzavírané mezi prodávajícím a jinou fyzickou osobou (dále jen „kupující“) prostřednictvím internetového obchodu prodávajícího. Internetový obchod je prodávajícím provozován na webové stránce umístněné na internetové adrese www.keramickazahrada.cz (dále jen „webová stránka“), a to prostřednictvím rozhraní webové stránky (dále jen „webové rozhraní obchodu“).",
        },
        {
          type: "p",
          text: "Obchodní podmínky se nevztahují na případy, kdy osoba, která má v úmyslu nakoupit zboží od prodávajícího, je právnickou osobou či osobou, jež jedná při objednávání zboží v rámci své podnikatelské činnosti nebo v rámci svého samostatného výkonu povolání.",
        },
        {
          type: "p",
          text: "Ustanovení odchylná od obchodních podmínek je možné sjednat v kupní smlouvě. Odchylná ujednání v kupní smlouvě mají přednost před ustanoveními obchodních podmínek.",
        },
        {
          type: "p",
          text: "Ustanovení obchodních podmínek jsou nedílnou součástí kupní smlouvy. Kupní smlouva a obchodní podmínky jsou vyhotoveny v českém jazyce. Kupní smlouvu lze uzavřít v českém jazyce.",
        },
        {
          type: "p",
          text: "Znění obchodních podmínek může prodávající měnit či doplňovat. Tímto ustanovením nejsou dotčena práva a povinnosti vzniklá po dobu účinnosti předchozího znění obchodních podmínek.",
        },
      ],
    },
    {
      id: "uzivatelsky-ucet",
      title: "II. UŽIVATELSKÝ ÚČET",
      blocks: [
        {
          type: "p",
          text: "Na základě registrace kupujícího provedené na webové stránce může kupující přistupovat do svého uživatelského rozhraní. Ze svého uživatelského rozhraní může kupující provádět objednávání zboží (dále jen „uživatelský účet“). V případě, že to webové rozhraní obchodu umožňuje, může kupující provádět objednávání zboží též bez registrace přímo z webového rozhraní obchodu.",
        },
        {
          type: "p",
          text: "Při registraci na webové stránce a při objednávání zboží je kupující povinen uvádět správně a pravdivě všechny údaje. Údaje uvedené v uživatelském účtu je kupující při jakékoliv jejich změně povinen aktualizovat. Údaje uvedené kupujícím v uživatelském účtu a při objednávání zboží jsou prodávajícím považovány za správné.",
        },
        {
          type: "p",
          text: "Přístup k uživatelskému účtu je zabezpečen uživatelským jménem a heslem. Kupující je povinen zachovávat mlčenlivost ohledně informací nezbytných k přístupu do jeho uživatelského účtu.",
        },
        {
          type: "p",
          text: "Kupující není oprávněn umožnit využívání uživatelského účtu třetím osobám.",
        },
        {
          type: "p",
          text: "Prodávající může zrušit uživatelský účet, a to zejména v případě, kdy kupující svůj uživatelský účet déle než 12 měsíců nevyužívá, či v případě, kdy kupující poruší své povinnosti z kupní smlouvy (včetně obchodních podmínek).",
        },
        {
          type: "p",
          text: "Kupující bere na vědomí, že uživatelský účet nemusí být dostupný nepřetržitě, a to zejména s ohledem na nutnou údržbu hardwarového a softwarového vybavení prodávajícího, popř. nutnou údržbu hardwarového a softwarového vybavení třetích osob.",
        },
      ],
    },
    {
      id: "uzavreni-kupni-smlouvy",
      title: "III. UZAVŘENÍ KUPNÍ SMLOUVY",
      blocks: [
        {
          type: "p",
          text: "Veškerá prezentace zboží umístěná ve webovém rozhraní obchodu je informativního charakteru a prodávající není povinen uzavřít kupní smlouvu ohledně tohoto zboží. Ustanovení § 1732 odst. 2 občanského zákoníku se nepoužije.",
        },
        {
          type: "p",
          text: "Webové rozhraní obchodu obsahuje informace o zboží, a to včetně uvedení cen jednotlivého zboží. Ceny zboží jsou uvedeny včetně daně z přidané hodnoty a všech souvisejících poplatků. Ceny zboží zůstávají v platnosti po dobu, kdy jsou zobrazovány ve webovém rozhraní obchodu. Tímto ustanovením není omezena možnost prodávajícího uzavřít kupní smlouvu za individuálně sjednaných podmínek.",
        },
        {
          type: "p",
          text: "Webové rozhraní obchodu obsahuje také informace o nákladech spojených s balením a dodáním zboží. Informace o nákladech spojených s balením a dodáním zboží uvedené ve webovém rozhraní obchodu platí pouze v případech, kdy je zboží doručováno v rámci území České republiky.",
        },
        {
          type: "p",
          text: "Pro objednání zboží vyplní kupující objednávkový formulář ve webovém rozhraní obchodu. Objednávkový formulář obsahuje zejména informace o: objednávaném zboží (objednávané zboží „vloží“ kupující do elektronického nákupního košíku webového rozhraní obchodu), způsobu úhrady kupní ceny zboží, údaje o požadovaném způsobu doručení objednávaného zboží a informace o nákladech spojených s dodáním zboží (dále společně jen jako „objednávka“).",
        },
        {
          type: "p",
          text: "Před zasláním objednávky prodávajícímu je kupujícímu umožněno zkontrolovat a měnit údaje, které do objednávky kupující vložil, a to i s ohledem na možnost kupujícího zjišťovat a opravovat chyby vzniklé při zadávání dat do objednávky.",
        },
        {
          type: "p",
          text: "Objednávku odešle kupující prodávajícímu kliknutím na tlačítko „ “. Údaje uvedené v objednávce jsou prodávajícím považovány za správné.",
        },
        {
          type: "p",
          text: "Odeslání objednávky se považuje za takový úkon kupujícího, který nepochybným způsobem identifikuje objednávané zboží, kupní cenu, osobu kupujícího, způsob úhrady kupní ceny, a je pro smluvní strany závazným návrhem kupní smlouvy.",
        },
        {
          type: "p",
          text: "Podmínkou platnosti objednávky je vyplnění všech povinných údajů v objednávkovém formuláři, seznámení se s těmito obchodními podmínkami na webové stránce a potvrzení kupujícího o tom, že se s těmito obchodními podmínkami seznámil.",
        },
        {
          type: "p",
          text: "Prodávající neprodleně po obdržení objednávky toto obdržení kupujícímu potvrdí elektronickou poštou, a to na adresu elektronické pošty kupujícího uvedenou v uživatelském rozhraní či v objednávce (dále jen „elektronická adresa kupujícího“).",
        },
        {
          type: "p",
          text: "Prodávající je vždy oprávněn v závislosti na charakteru objednávky (množství zboží, výše kupní ceny, předpokládané náklady na dopravu) požádat kupujícího o dodatečné potvrzení objednávky (například písemně či telefonicky).",
        },
        {
          type: "p",
          text: "Návrh kupní smlouvy ve formě objednávky má platnost patnáct dnů.",
        },
        {
          type: "p",
          text: "Smluvní vztah mezi prodávajícím a kupujícím vzniká doručením přijetí objednávky (akceptací), jež je prodávajícím zasláno kupujícímu elektronickou poštou, a to na adresu elektronické pošty kupujícího.",
        },
        {
          type: "p",
          text: "V případě, že některý z požadavků uvedených v objednávce nemůže prodávající splnit, zašle kupujícímu na elektronickou adresu kupujícího pozměněnou nabídku s uvedením možných variant objednávky a vyžádá si stanovisko kupujícího.",
        },
        {
          type: "p",
          text: "Pozměněná nabídka se považuje za nový návrh kupní smlouvy a kupní smlouva je v takovém případě uzavřena až akceptací kupujícího prostřednictvím elektronické pošty.",
        },
        {
          type: "p",
          text: "Kupující souhlasí s použitím komunikačních prostředků na dálku při uzavírání kupní smlouvy. Náklady vzniklé kupujícímu při použití komunikačních prostředků na dálku v souvislosti s uzavřením kupní smlouvy (náklady na internetové připojení, náklady na telefonní hovory) si hradí kupující sám, přičemž tyto náklady se neliší od základní sazby.",
        },
      ],
    },
    {
      id: "cena-a-platba",
      title: "IV. CENA ZBOŽÍ A PLATEBNÍ PODMÍNKY",
      blocks: [
        {
          type: "p",
          text: "Cenu zboží a případné náklady spojené s dodáním zboží dle kupní smlouvy může kupující uhradit prodávajícímu následujícími způsoby:",
        },
        {
          type: "ul",
          items: [
            "v hotovosti na dobírku v místě určeném kupujícím v objednávce;",
            "bezhotovostně převodem na účet prodávajícího č. 2500675505/2010 (Fio), v měně CZK, nebo č. 2701281289/2010 (Fio) v měně EUR (dále jen „účet prodávajícího“);",
            "bezhotovostně prostřednictvím platebního systému;",
          ],
        },
        {
          type: "p",
          text: "Společně s kupní cenou je kupující povinen zaplatit prodávajícímu také náklady spojené s balením a dodáním zboží ve smluvené výši. Není-li uvedeno výslovně jinak, rozumí se dále kupní cenou i náklady spojené s dodáním zboží.",
        },
        {
          type: "p",
          text: "Prodávající nepožaduje od kupujícího zálohu či jinou obdobnou platbu. Tímto není dotčeno ustanovení čl. IV. odst. 6 obchodních podmínek ohledně povinnosti uhradit kupní cenu zboží předem. Netýká se výroby zboží na zakázku.",
        },
        {
          type: "p",
          text: "V případě platby v hotovosti či v případě platby na dobírku je kupní cena splatná při převzetí zboží. V případě bezhotovostní platby je kupní cena splatná do 14 dnů od uzavření kupní smlouvy.",
        },
        {
          type: "p",
          text: "V případě bezhotovostní platby je kupující povinen uhrazovat kupní cenu zboží společně s uvedením variabilního symbolu platby. V případě bezhotovostní platby je závazek kupujícího uhradit kupní cenu splněn okamžikem připsání příslušné částky na účet prodávajícího.",
        },
        {
          type: "p",
          text: "Prodávající je oprávněn, zejména v případě, že ze strany kupujícího nedojde k dodatečnému potvrzení objednávky (čl. III. odst. 6), požadovat uhrazení celé kupní ceny ještě před odesláním zboží kupujícímu. Ustanovení § 2119 odst. 1 občanského zákoníku se nepoužije.",
        },
        {
          type: "p",
          text: "Případné slevy z ceny zboží poskytnuté prodávajícím kupujícímu nelze vzájemně kombinovat.",
        },
        {
          type: "p",
          text: "Je-li to v obchodním styku obvyklé nebo je-li tak stanoveno obecně závaznými právními předpisy, vystaví prodávající ohledně plateb prováděných na základě kupní smlouvy kupujícímu daňový doklad – fakturu. Prodávající je plátcem daně z přidané hodnoty. Daňový doklad – fakturu vystaví prodávající kupujícímu po uhrazení ceny zboží a zašle jej v elektronické podobě na elektronickou adresu kupujícího.",
        },
      ],
    },
    {
      id: "odstoupeni",
      title: "V. ODSTOUPENÍ OD KUPNÍ SMLOUVY",
      blocks: [
        {
          type: "p",
          text: "Kupující bere na vědomí, že dle ustanovení § 1837 občanského zákoníku, nelze mimo jiné odstoupit od kupní smlouvy:",
        },
        {
          type: "ul",
          items: [
            "o dodávce zboží, jehož cena závisí na výchylkách finančního trhu nezávisle na vůli prodávajícího a k němuž může dojít během lhůty pro odstoupení od smlouvy,",
            "o dodávce zboží, které bylo upraveno podle přání kupujícího nebo pro jeho osobu",
            "o dodávce zboží v uzavřeném obalu, které kupující z obalu vyňal a z hygienických důvodů jej není možné vrátit,",
          ],
        },
        {
          type: "p",
          text: "Nejedná-li se o případ uvedený v čl. V. odst. 1 či o jiný případ, kdy nelze od kupní smlouvy odstoupit, má kupující v souladu s ustanovením § 1829 odst. 1 občanského zákoníku právo od kupní smlouvy odstoupit, a to do čtrnácti (14) dnů od převzetí zboží, přičemž v případě, že předmětem kupní smlouvy je několik druhů zboží nebo dodání několika částí, běží tato lhůta ode dne převzetí poslední dodávky zboží. Odstoupení od kupní smlouvy musí být prodávajícímu odesláno ve lhůtě uvedené v předchozí větě.",
        },
        {
          type: "p",
          text: "Odstoupení od kupní smlouvy může kupující zasílat přímo na adresu sídla prodávajícího. Pro doručování odstoupení od smlouvy platí ustanovení čl. 11 těchto obchodních podmínek.",
        },
        {
          type: "p",
          text: "V případě odstoupení od kupní smlouvy dle čl. V. odst. 2 obchodních podmínek se kupní smlouva od počátku ruší. Zboží musí být prodávajícímu vráceno do čtrnácti (14) dnů od odstoupení od smlouvy prodávajícímu.",
        },
        {
          type: "p",
          text: "V případě odstoupení od smlouvy dle čl. V. odst. 2 obchodních podmínek vrátí prodávající peněžní prostředky přijaté od kupujícího do čtrnácti (14) dnů od odstoupení od kupní smlouvy kupujícím, a to buď peněžní poukázkou, nebo bezhotovostně na kupujícím uvedený účet. Náklady spojené s vrácením zboží si kupující hradí sám. Odstoupí-li kupující od kupní smlouvy, prodávající není povinen vrátit přijaté peněžní prostředky kupujícímu dříve, než mu kupující zboží vrátí nebo prokáže, že zboží prodávajícímu odeslal.",
        },
        {
          type: "p",
          text: "Nárok na úhradu škody vzniklé na zboží je prodávající oprávněn jednostranně započíst proti nároku kupujícího na vrácení kupní ceny.",
        },
        {
          type: "p",
          text: "Do doby převzetí zboží kupujícím je prodávající oprávněn kdykoliv od kupní smlouvy odstoupit. V takovém případě vrátí prodávající kupujícímu kupní cenu bez zbytečného odkladu, a to bezhotovostně na účet určený kupujícím.",
        },
      ],
    },
    {
      id: "preprava-a-dodani",
      title: "VI. PŘEPRAVA A DODÁNÍ ZBOŽÍ",
      blocks: [
        {
          type: "p",
          text: "V případě, že je způsob dopravy smluven na základě zvláštního požadavku kupujícího, nese kupující riziko a případné dodatečné náklady spojené s tímto způsobem dopravy. Je-li prodávající podle kupní smlouvy povinen dodat zboží na místo určené kupujícím v objednávce, je kupující povinen převzít zboží při dodání.",
        },
        {
          type: "p",
          text: "V případě, že je z důvodů na straně kupujícího nutno zboží doručovat opakovaně nebo jiným způsobem, než bylo uvedeno v objednávce, je kupující povinen uhradit náklady spojené s opakovaným doručováním zboží, resp. náklady spojené s jiným způsobem doručení.",
        },
        {
          type: "p",
          text: "Při převzetí zboží od přepravce je kupující povinen zkontrolovat neporušenost obalů zboží a v případě jakýchkoliv závad toto neprodleně oznámit přepravci. V případě shledání porušení obalu svědčícího o neoprávněném vniknutí do zásilky nemusí kupující zásilku od přepravce převzít.",
        },
        {
          type: "p",
          text: "Reklamaci poškození vzniklého při přepravě uplatňuje u dopravce příjemce zásilky. Podle podmínek České pošty je nutné poškození oznámit při převzetí, nejpozději do dvou pracovních dnů od dodání; po uplynutí této lhůty dopravce reklamaci nepřijme. Převezme-li kupující zásilku bez výhrad a poškození oznámí až po této lhůtě, nemůže prodávající poskytnout náhradu ani výměnu zboží. Tím nejsou dotčena práva kupujícího z vadného plnění u vad, které nevznikly přepravou.",
        },
      ],
    },
    {
      id: "prava-z-vadneho-plneni",
      title: "VII. PRÁVA Z VADNÉHO PLNĚNÍ",
      blocks: [
        {
          type: "p",
          text: "Práva a povinnosti smluvních stran ohledně práv z vadného plnění se řídí příslušnými obecně závaznými předpisy (zejména ustanoveními § 1914 až 1925, § 2099 až 2117 a § 2161 až 2174 občanského zákoníku).",
        },
        {
          type: "p",
          text: "Prodávající odpovídá kupujícímu, že zboží při převzetí nemá vady. Zejména prodávající odpovídá kupujícímu, že v době, kdy kupující zboží převzal:",
        },
        {
          type: "ul",
          items: [
            "má zboží vlastnosti, které si strany ujednaly, a chybí-li ujednání, má takové vlastnosti, které prodávající nebo výrobce popsal nebo které kupující očekával s ohledem na povahu zboží a na základě reklamy jimi prováděné,",
            "se zboží hodí k účelu, který pro jeho použití prodávající uvádí nebo ke kterému se zboží tohoto druhu obvykle používá,",
            "zboží odpovídá jakostí nebo provedením smluvenému vzorku nebo předloze, byla-li jakost nebo provedení určeno podle smluveného vzorku nebo předlohy,",
            "je zboží v odpovídajícím množství, míře nebo hmotnosti a zboží vyhovuje požadavkům právních předpisů.",
          ],
        },
        {
          type: "p",
          text: "Ustanovení uvedená v čl. VII. odst. 2 obchodních podmínek se nepoužijí u zboží prodávaného za nižší cenu na vadu, pro kterou byla nižší cena ujednána, na opotřebení zboží způsobené jeho obvyklým užíváním, u použitého zboží na vadu odpovídající míře používání nebo opotřebení, kterou zboží mělo při převzetí kupujícím, nebo vyplývá-li to z povahy zboží.",
        },
        {
          type: "p",
          text: "Projeví-li se vada v průběhu šesti měsíců od převzetí, má se za to, že zboží bylo vadné již při převzetí.",
        },
        {
          type: "p",
          text: "Práva z vadného plnění uplatňuje kupující u prodávajícího na adrese jeho provozovny, v níž je přijetí reklamace možné s ohledem na sortiment prodávaného zboží, případně i v sídle nebo místě podnikání. Za okamžik uplatnění reklamace se považuje okamžik, kdy prodávající obdržel od kupujícího reklamované zboží.",
        },
        {
          type: "p",
          text: "Další práva a povinnosti stran související s odpovědností prodávajícího za vady může upravit reklamační řád prodávajícího.",
        },
      ],
    },
    {
      id: "dalsi-prava-a-povinnosti",
      title: "VIII. DALŠÍ PRÁVA A POVINNOSTI SMLUVNÍCH STRAN",
      blocks: [
        {
          type: "p",
          text: "Kupující nabývá vlastnictví ke zboží zaplacením celé kupní ceny zboží.",
        },
        {
          type: "p",
          text: "Prodávající není ve vztahu ke kupujícímu vázán žádnými kodexy chování ve smyslu ustanovení § 1826 odst. 1 písm. e) občanského zákoníku.",
        },
        {
          type: "p",
          text: "Mimosoudní vyřizování stížností spotřebitelů zajišťuje prodávající prostřednictvím elektronické adresy . Informaci o vyřízení stížnosti kupujícího zašle prodávající na elektronickou adresu kupujícího.",
        },
        {
          type: "p",
          text: "Prodávající je oprávněn k prodeji zboží na základě živnostenského oprávnění. Živnostenskou kontrolu provádí v rámci své působnosti příslušný živnostenský úřad. Dozor nad oblastí ochrany osobních údajů vykonává Úřad pro ochranu osobních údajů. Česká obchodní inspekce vykonává ve vymezeném rozsahu mimo jiné dozor nad dodržováním zákona č. 634/1992 Sb., o ochraně spotřebitele, ve znění pozdějších předpisů.",
        },
        {
          type: "p",
          text: "Kupující tímto přebírá na sebe nebezpečí změny okolností ve smyslu § 1765 odst. 2 občanského zákoníku.",
        },
      ],
    },
    {
      id: "ochrana-udaju",
      title: "IX. OCHRANA ÚDAJŮ",
      blocks: [
        {
          type: "p",
          text: "Ochrana osobních údajů kupujícího, který je fyzickou osobou, je poskytována zákonem č. 101/2000 Sb., o ochraně osobních údajů, ve znění pozdějších předpisů.",
        },
        {
          type: "p",
          text: "Kupující souhlasí se zpracováním těchto svých osobních údajů: jméno a příjmení, adresa bydliště, identifikační číslo, daňové identifikační číslo, adresa elektronické pošty, telefonní číslo a (dále společně vše jen jako „osobní údaje“).",
        },
        {
          type: "p",
          text: "Kupující souhlasí se zpracováním osobních údajů prodávajícím, a to pro účely realizace práv a povinností z kupní smlouvy a pro účely vedení uživatelského účtu. Nezvolí-li kupující jinou možnost, souhlasí se zpracováním osobních údajů prodávajícím také pro účely zasílání informací a obchodních sdělení kupujícímu. Souhlas se zpracováním osobních údajů v celém rozsahu dle tohoto článku není podmínkou, která by sama o sobě znemožňovala uzavření kupní smlouvy.",
        },
        {
          type: "p",
          text: "Kupující bere na vědomí, že je povinen své osobní údaje (při registraci, ve svém uživatelském účtu, při objednávce provedené z webového rozhraní obchodu) uvádět správně a pravdivě a že je povinen bez zbytečného odkladu informovat prodávajícího o změně ve svých osobních údajích.",
        },
        {
          type: "p",
          text: "Zpracováním osobních údajů kupujícího může prodávající pověřit třetí osobu, jakožto zpracovatele. Kromě osob dopravujících zboží nebudou osobní údaje prodávajícím bez předchozího souhlasu kupujícího předávány třetím osobám.",
        },
        {
          type: "p",
          text: "Osobní údaje budou zpracovávány po dobu neurčitou. Osobní údaje budou zpracovávány v elektronické podobě automatizovaným způsobem nebo v tištěné podobě neautomatizovaným způsobem.",
        },
        {
          type: "p",
          text: "Kupující potvrzuje, že poskytnuté osobní údaje jsou přesné a že byl poučen o tom, že se jedná o dobrovolné poskytnutí osobních údajů.",
        },
        {
          type: "p",
          text: "V případě, že by se kupující domníval, že prodávající nebo zpracovatel (čl. IX. odst. 5) provádí zpracování jeho osobních údajů, které je v rozporu s ochranou soukromého a osobního života kupujícího nebo v rozporu se zákonem, zejména jsou-li osobní údaje nepřesné s ohledem na účel jejich zpracování, může: požádat prodávajícího nebo zpracovatele o vysvětlení, požadovat, aby prodávající nebo zpracovatel odstranil takto vzniklý stav.",
        },
        {
          type: "p",
          text: "Požádá-li kupující o informaci o zpracování svých osobních údajů, je mu prodávající povinen tuto informaci předat. Prodávající má právo za poskytnutí informace podle předchozí věty požadovat přiměřenou úhradu nepřevyšující náklady nezbytné na poskytnutí informace.",
        },
      ],
    },
    {
      id: "dorucovani",
      title: "X. DORUČOVÁNÍ",
      blocks: [
        {
          type: "p",
          text: "Oznámení týkající se vztahů prodávajícího a kupujícího, zejména týkající odstoupení od kupní smlouvy, musí být doručena poštou formou doporučeného dopisu, není-li v kupní smlouvě stanoveno jinak. Oznámení se doručují na příslušnou kontaktní adresu druhé strany a považují se za doručené a účinné okamžikem jejich dodání prostřednictvím pošty, s výjimkou oznámení o odstoupení od smlouvy učiněného kupujícím, kdy je odstoupení účinné, pokud je oznámení kupujícím ve lhůtě pro odstoupení odesláno.",
        },
        {
          type: "p",
          text: "Za doručené se považuje i oznámení, jehož převzetí bylo adresátem odmítnuto, které nebylo vyzvednuto v úložní době, nebo které se vrátilo jako nedoručitelné.",
        },
        {
          type: "p",
          text: "Smluvní strany mohou běžnou korespondenci vzájemně doručovat prostřednictvím elektronické pošty, a to na adresu elektronické pošty uvedenou v uživatelském účtu kupujícího či uvedenou kupujícím v objednávce, resp. na adresu uvedenou na webové stránce prodávajícího.",
        },
      ],
    },
    {
      id: "zaverecna-ustanoveni",
      title: "XI. ZÁVĚREČNÁ USTANOVENÍ",
      blocks: [
        {
          type: "p",
          text: "Je-li některé ustanovení obchodních podmínek neplatné nebo neúčinné, nebo se takovým stane, namísto neplatných ustanovení nastoupí ustanovení, jehož smysl se neplatnému ustanovení co nejvíce přibližuje. Neplatností nebo neúčinností jednoho ustanovení není dotknutá platnost ostatních ustanovení. Změny a doplňky kupní smlouvy či obchodních podmínek vyžadují písemnou formu.",
        },
        {
          type: "p",
          text: "Kupní smlouva včetně obchodních podmínek je archivována prodávajícím v elektronické podobě a není přístupná.",
        },
        { type: "p", text: "Obchodní podmínky platné od 1.1. 2015" },
        { type: "p", text: "V Písku dne 1.1. 2015" },
      ],
    },
  ],
}

export default obchodniPodminky2015
