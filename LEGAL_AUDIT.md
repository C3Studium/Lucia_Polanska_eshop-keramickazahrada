# Keramická zahrada – právní audit e-shopu

Datum: 14. 10. 2026 · Autor auditu: Matěj Forejt (ValeStudium) · Obchod: https://store.matejforejt.com/cz (ostrá doména keramickazahrada.cz)

Audit stránek obchodu (obchodní podmínky, odstoupení, reklamace, doprava, kurzy, poukazy, GDPR, cookies) proti občanskému zákoníku (OZ, 89/2012 Sb.) a zákonu o ochraně spotřebitele (ZOS, 634/1992 Sb.) ve znění k říjnu 2026. Jde o technicko-věcný audit, ne právní stanovisko — finální znění OP má před spuštěním přečíst advokát.

---

## 1. Souhrn

Obchod v současném stavu **není připravený na ostrý provoz**: obchodní podmínky jsou z 1. 1. 2015 a nereflektují novelu OZ 374/2022 Sb. (účinnou od 6. 1. 2023), zakázková výroba nemá žádná pravidla a web si na několika místech odporuje (dvě různá čísla účtů, neexistující PlatímPak, nevyplněný název tlačítka v OP). Většina oprav je textová, část je v kódu.

| # | Oblast | Stav | Závažnost | Kde se to opraví |
| --- | --- | --- | --- | --- |
| 1 | OP z roku 2015 — chybí novela 2023 (domněnka vady 12 měsíců, info povinnosti § 1820, § 1826a) | Nevyhovuje | Kritické | OP (text) |
| 2 | Zakázková výroba — žádná pravidla pro zálohu, schválení návrhu, zrušení, odchylky | Chybí | Kritické | OP + produkt + checkout |
| 3 | Odstoupení — vrací se „kupní cena“, ne nejlevnější nabízené poštovné; chybí vzorové poučení dle NV 29/2023 Sb. | Nevyhovuje | Kritické | OP + stránka Odstoupení |
| 4 | Reklamace — přepravní poškození přenáší OP celé na kupujícího (rozpor s § 2161 a násl.); domněnka 6 měsíců místo 12 | Nevyhovuje | Kritické | OP + Reklamační protokol |
| 5 | Mimosoudní řešení sporů — chybí plná informace o ČOI dle § 14 ZOS; e-mail pro stížnosti je prázdný | Chybí | Důležité | OP |
| 6 | Kurzy — žádné storno podmínky, žádné poučení o výjimce z odstoupení (§ 1837 písm. j) | Chybí | Důležité | OP + stránka Kurzy |
| 7 | Dárkové poukazy — poukaz za 1 Kč s převodem „libovolné částky“, platnost, nevratnost neupravena | Nejasné | Důležité | Produkt + OP |
| 8 | GDPR text odkazuje na zrušený zákon 101/2000 Sb. a „souhlas“ jako základ pro plnění smlouvy | Nevyhovuje | Důležité | OP čl. IX (smazat) + stránka GDPR |
| 9 | Cookies — stránka tvrdí „nesbíráme osobní údaje“ a zároveň Google Analytics | Rozpor | Důležité | Stránka Cookies + lišta |
| 10 | Dvě různá čísla účtů (OP: 2500675505/2010 a 2701281289/2010; Doprava: 7010757121/2010) | Rozpor | Důležité | OP / Doprava |
| 11 | PlatímPak (Equa Bank) — služba už neexistuje, Equa zanikla fúzí 2022 | Zastaralé | Důležité | Doprava a platba |
| 12 | OP čl. III: „kliknutím na tlačítko „ ““ — prázdný název tlačítka | Chyba | Kosmetické, ale viditelné | OP |
| 13 | OP uvádějí doménu keramickazahrada.cz, obchod běží na store.matejforejt.com | Rozpor | Kosmetické (do spuštění) | OP |
| 14 | Tlačítko „Odstoupit od smlouvy“ v online rozhraní (§ 1830a) — připravit, novela v legislativním procesu | Připravit | Výhled | Kód (účet / e-mail) |

Pořadí prací: nejdřív body 1–4 (bez nich hrozí pokuta od ČOI a neplatnost ujednání ve prospěch spotřebitele), pak 5–11, nakonec kosmetika.

---

## 2. Zakázková výroba

Dnes zakázku na webu nic neupravuje: OP ji zmiňují jednou větou („Netýká se výroby zboží na zakázku“ u zálohy), stránka Výroba je o procesu, FAQ má jen obecné odpovědi a produkty „NA ZAKÁZKU“ (domovní znamení 6 000 Kč, domovní čísla, souhvězdí na zvonku) se objednávají jako běžné zboží. To je právně nejslabší místo celého obchodu, protože u zakázky Lucie nejvíc riskuje — vyrobí kus, který už nikomu jinému neprodá.

### Co říká zákon

- Zboží „vyrobené podle požadavků spotřebitele nebo přizpůsobené jeho osobním potřebám“ je výjimkou z práva odstoupit do 14 dnů (§ 1837 písm. d) OZ). Výjimka platí jen tehdy, když o ní byl spotřebitel **předem poučen** (§ 1820 odst. 1 písm. j) OZ). Bez poučení může zákazník vrátit i zakázkové domovní číslo.
- Výjimka se vztahuje jen na skutečnou individualizaci (číslo domu, jméno, konkrétní souhvězdí, rozměr na míru). Výběr barvy z nabízených variant individualizace není — takový kus vrátit lze.
- Odpovědnost za vady platí i u zakázky: 2 roky, domněnka vady při převzetí 12 měsíců. „Nelíbí se mi to“ není vada; odchylka od **odsouhlaseného** návrhu (jiný motiv, výrazně jiný rozměr) vada je.
- Zálohu zákon u spotřebitele nezakazuje. Musí být sjednaná před uzavřením smlouvy a uvedená v předsmluvních informacích. Nevratná záloha musí být přiměřená skutečným nákladům — propadnutí celé ceny by ČOI posoudila jako nepřiměřené ujednání (§ 1813 OZ).

### Doporučený proces zakázky

1. Poptávka přes formulář (stránka Výroba nebo FAQ) — popis, rozměr, motiv, fotografie místa, termín.
2. Lucie pošle **cenovou nabídku s náčrtem nebo popisem** e-mailem. Nabídka obsahuje cenu, dodací lhůtu, výši zálohy, odkaz na OP a výslovné poučení, že jde o zboží na míru bez práva na odstoupení.
3. Zákazník nabídku potvrdí (odpověď e-mailem nebo zaplacením zálohy) — tím vzniká smlouva. Záloha 30–50 % se platí přes individuální produkt / platební odkaz v e-shopu.
4. Před výpalem Lucie pošle fotografii rozmodelovaného kusu ke schválení; schválený návrh se stává závaznou „předlohou“ (§ 2161 odst. 1 písm. c) OZ).
5. Po dokončení doplatek, pak odeslání. Zakázka se dodává jako pojištěný křehký balík.

### Návrh znění pro OP — nový článek „Výroba na zakázku“

1. Výrobou na zakázku se rozumí zboží vyrobené podle individuálních požadavků kupujícího nebo upravené pro jeho osobu (zejména domovní čísla a znamení s konkrétním textem či motivem, rozměry na míru, reliéfy podle zadání).
2. Zakázka vzniká na základě písemné poptávky kupujícího a cenové nabídky prodávajícího. Smlouva je uzavřena potvrzením nabídky kupujícím nebo zaplacením zálohy, podle toho, co nastane dříve.
3. Prodávající je oprávněn požadovat zálohu ve výši uvedené v nabídce, nejvýše 50 % ceny. Výroba začíná po připsání zálohy.
4. Kupující bere na vědomí, že podle § 1837 písm. d) občanského zákoníku **nemůže od smlouvy o výrobě zboží na zakázku odstoupit** ve lhůtě 14 dnů, protože jde o zboží upravené podle jeho přání.
5. Zruší-li kupující zakázku před zahájením výroby, prodávající vrátí zálohu v plné výši. Zruší-li ji po zahájení výroby, může si prodávající ze zálohy ponechat částku odpovídající nákladům skutečně vynaloženým do dne zrušení (materiál, práce, výpal); zbytek vrátí do 14 dnů.
6. Prodávající před konečným výpalem zašle kupujícímu fotografii výrobku ke schválení. Schválením se podoba výrobku stává smluvenou předlohou. Neodpoví-li kupující do 5 pracovních dnů, považuje se návrh za schválený.
7. Ruční výroba přináší drobné odchylky v odstínu glazury, struktuře povrchu a rozměrech (do ±5 %, není-li sjednáno jinak). Tyto odchylky nejsou vadou. Vadou je rozpor se schválenou předlohou nebo poškození výrobku.
8. Práva z vadného plnění se u zakázky řídí článkem o právech z vadného plnění těchto podmínek.

### Co dát na stránku produktu „NA ZAKÁZKU“ a do košíku

- Štítek „Na zakázku — bez možnosti vrácení do 14 dnů“ přímo u ceny, ne jen v záložce Doprava a vrácení.
- Při přidání takového produktu do košíku a v posledním kroku objednávky zobrazit checkbox: „Beru na vědomí, že zboží vyrobené na zakázku nelze vrátit ve 14denní lhůtě.“ Tento stav uložit k objednávce (Medusa order metadata) — je to důkaz poučení.
- Povinné textové pole pro zadání (číslo domu, text, motiv), aby bylo zadání součástí objednávky.
- Produkty typu „Domovní znamení NA ZAKÁZKU 6 000 Kč“ s textem „cena dohodou“ nesoucí pevnou cenu jsou matoucí: buď pevná cena za standardní rozsah + příplatky, nebo produkt bez ceny s tlačítkem „Poptat“.

---

## 3. Odstoupení od smlouvy a vrácení peněz

Základ je správně (14 dnů od převzetí, lhůta běží od poslední dodávky, stačí odeslat), ale v detailech OP čl. V i stránka Odstoupení zaostávají za § 1820, § 1829–1837 OZ a nařízením vlády 29/2023 Sb.

| Co | Dnes na webu | Co má být | Oprava |
| --- | --- | --- | --- |
| Co se vrací | „peněžní prostředky přijaté od kupujícího“, formulář žádá „kupní cenu včetně účtovaného dopravného“ | Kupní cena **a náklady na dodání ve výši nejlevnějšího nabízeného způsobu** (§ 1832 odst. 2). Zvolil-li zákazník dražší dopravu na adresu, rozdíl se nevrací. | Doplnit do OP i do vzorového formuláře |
| Jak se vrací | „peněžní poukázkou nebo bezhotovostně na účet“ | Stejným způsobem, jakým zákazník platil, jiný jen se souhlasem (§ 1832 odst. 1). | Přepsat |
| Vzorové poučení | Jen vlastní formulář | Podnikatel musí poskytnout poučení o odstoupení ve znění NV 29/2023 Sb. (od 19. 6. 2026 ve znění NV 66/2026 Sb.) — převzít doslova | Nová sekce na stránce Odstoupení |
| Odpovědnost za snížení hodnoty | „nárok na úhradu škody“ jednostranně započte | Zákazník odpovídá jen za snížení hodnoty nad rámec seznámení se s povahou a vlastnostmi zboží (§ 1833) | Zpřesnit |
| Kdo platí vrácení | „náklady spojené s vrácením zboží si kupující hradí sám“ | V pořádku, jen pokud sděleno předem (§ 1820 písm. i); u keramiky doplnit odhad nákladů | Doplnit větu o balení a odhad ceny |
| Doručování odstoupení | Čl. X: oznámení jen **doporučeným dopisem** | Odstoupení lze učinit jakýmkoliv jednoznačným prohlášením, i e-mailem (§ 1830). Požadavek na doporučený dopis je neplatný | Smazat, nahradit: „e-mailem na …, nebo poštou na adresu sídla“ |
| Výjimky z odstoupení | Vyjmenovány 3, chybí ta hlavní pro tento obchod | Doplnit výjimku pro služby s určitým termínem — kurzy (§ 1837 písm. j); zrušit „cena závisí na výchylkách finančního trhu“ | Přepsat seznam |
| Odstoupení prodávajícího | „do převzetí kdykoliv“ | Omezit na vyprodání kusu, nedostupnost materiálu nebo zjevnou chybu v ceně, s okamžitým vrácením platby | Zpřesnit |
| Prohlášení ve formuláři | Zákazník prohlašuje, že zboží „není zbožím uvedeným v § 1837“ | Zbytečné a matoucí — zákazník nemá posuzovat zákonné výjimky | Smazat |

### Praktické doporučení k vracení peněz

- Vracet vždy na účet, ze kterého přišla platba (ComGate umí refund na kartu z administrace). Do OP: „Peníze vracíme stejným způsobem, jakým jste platili.“
- Lhůta 14 dnů od odstoupení, s právem zadržet refund do doby, než zákazník zboží vrátí nebo prokáže odeslání (§ 1832 odst. 4) — v OP je, ponechat.
- Zboží z kolekce „Poškozené“ / „Výrobky se slevou“ s uvedeným důvodem slevy: vada, pro kterou je sleva, se nereklamuje, ale odstoupit do 14 dnů lze. Uvést u těchto produktů.
- Rozbité při přepravě **zpět** (když zákazník vrací): riziko nese zákazník jako odesílatel. V návodu k vrácení doporučit původní obal a pojištění.

---

## 4. Reklamace

Reklamační protokol je napsaný lidsky a 30denní lhůta i úhrada dopravy u oprávněné reklamace jsou správně. Tři věci jsou v rozporu se zákonem.

**1. Přepravní poškození nelze přehodit na zákazníka.** OP čl. VI a Reklamační protokol tvrdí, že poškození při přepravě reklamuje zákazník u České pošty do 2 pracovních dnů, jinak „zboží zůstává vaše“. To je neplatné: prodávající odpovídá, že zboží **při převzetí** nemá vady (§ 2161 odst. 1), a nebezpečí škody přechází na spotřebitele až převzetím (§ 2159 odst. 2). Rozbité pítko v krabici je vada při převzetí; zákazník ji může reklamovat u Lucie ve 2 letech, domněnka 12 měsíců hraje v jeho prospěch. Dvoudenní lhůta České pošty je vztah Lucie–dopravce. Správný postup: zákazník nahlásí Lucii (s fotkami), Lucie vymění nebo vrátí peníze a sama uplatní škodu u dopravce z pojištění balíku. Text o kontrole zásilky před doručovatelem může zůstat jako **prosba**, ne jako podmínka.

**2. Domněnka vady 6 měsíců → 12 měsíců.** OP čl. VII odst. 4 uvádí 6 měsíců; od 6. 1. 2023 platí 12 (§ 2161 odst. 5).

**3. Okamžik uplatnění reklamace.** OP i protokol říkají, že reklamace je uplatněna, až když Lucie „obdrží reklamované zboží“. Podle § 19 ZOS běží 30 dnů od okamžiku, kdy spotřebitel reklamaci **uplatní** (napíše e-mail), ne od doručení zboží. Překročení 30 dnů zakládá právo odstoupit.

### Co doplnit do OP / reklamačního řádu

- Práva zákazníka při vadě v pořadí podle § 2169–2171: nejdřív oprava nebo výměna, teprve pak sleva nebo odstoupení; odstoupit lze rovnou, je-li vada podstatná nebo se opakuje.
- Písemné potvrzení o přijetí reklamace (datum, obsah, požadovaný způsob vyřízení) — povinné dle § 19 odst. 1 ZOS. Stačí automatický e-mail.
- Reklamační protokol ke stažení: stránka říká „formulář ještě dokončujeme“ — doplnit PDF, nebo větu smazat.
- Výslovně: odchylky ruční výroby (odstín, struktura, rozměr v uvedené toleranci) nejsou vadou — do OP s konkrétními tolerancemi, které jsou už u produktů („tolerance −3 cm“).
- U pítek a nádob, které nesmí zamrznout: vada vzniklá nesprávným použitím (zamrzlá voda) se nereklamuje — jen pokud byl zákazník poučen (doplnit i na kartičku k balení).
- Smazat „Projeví-li se vada v průběhu šesti měsíců“ a nahradit dvanácti.

---

## 5. Kurzy a dárkové poukazy

### Kurzy

Kurz je smlouva o poskytnutí služby, ne kupní smlouva — OP čl. I ji dnes nepokrývají. Rezervace na stránce Kurzy („zaplatit předem kartou, nebo až na místě“) se uzavírá bez jakýchkoli podmínek.

- Kurz s konkrétním termínem spadá pod § 1837 písm. j) OZ — „využití volného času, poskytované v určitém termínu“. Zákazník **nemá** právo odstoupit do 14 dnů, ale jen pokud byl předem poučen.
- Doporučené storno podmínky: zrušení 7+ dní předem — vrácení 100 %; 2–6 dní předem — vrácení 50 % nebo přesun na jiný termín zdarma; méně než 48 h / neúčast — bez náhrady, lze poslat náhradníka. Zruší-li kurz Lucie, vrátí 100 % nebo nabídne náhradní termín.
- Děti: rezervaci dělá zákonný zástupce; uvést minimální věk a že rodič odpovídá za dítě mimo vedenou práci.
- Výrobek z kurzu: dohotovení (glazura, výpal) a vyzvednutí — do kdy, co když se při výpalu rozbije (riziko materiálu nese kurzista, slušné je nabídnout opakování).
- Fotografie z kurzu na sociální sítě jen se souhlasem (checkbox při rezervaci, u dětí od rodiče).

### Dárkové poukazy

- Poukaz koupený na dálku **lze vrátit do 14 dnů**, dokud nebyl uplatněn. Po uplatnění (byť částečném) už ne — napsat do OP.
- Platnost 1 rok je uvedena jen u „volné“ varianty; u pevných hodnot (500–3 000 Kč) chybí. Sjednotit a uvést na každém poukazu datum konce platnosti. Po propadnutí se hodnota nevrací — musí být napsáno předem.
- Produkt „Dárkový poukaz na nákup keramiky, 1 Kč“ s instrukcí „objednejte a libovolnou částku převeďte na účet“ je problém: cena v košíku neodpovídá platbě (rozpor s § 1820 a § 1826a), uvádí poštovné 60 Kč v rozporu s ceníkem dopravy a soukromý e-mail lucie.polanska@gmail.com. Nahradit variantami nebo polem „vlastní hodnota“ s minimem; cena se musí propsat do košíku.
- Poukaz se neslevuje a nevyměňuje za peníze; při nákupu nad hodnotu se doplácí, při nákupu pod hodnotu zbytek propadá nebo zůstává na kódu — rozhodnout a napsat.
- Ujasnit, že poukazem lze uhradit část zakázky (záloha / doplatek).

---

## 6. Rozpory a chyby na webu

| Kde | Co je špatně | Oprava |
| --- | --- | --- |
| OP čl. IV | Účty 2500675505/2010 (CZK) a 2701281289/2010 (EUR) | Stránka Doprava uvádí 7010757121/2010 — ověřit s Lucií, který platí, a sjednotit |
| OP čl. I, formulář Odstoupení | Obchod běží na www.keramickazahrada.cz | Před spuštěním přepsat na ostrou doménu |
| OP čl. III | „kliknutím na tlačítko „ “.“ — prázdný název | Doplnit „Objednávka zavazující k platbě“ |
| OP patička | „Platné od 1. 1. 2015“, „V Písku dne 1. 1. 2015“ | Nové datum účinnosti; staré znění archivovat pro starší objednávky |
| OP čl. I | „obchodní společnosti Lucie Polanská“ | Lucie je OSVČ: „podnikatelka Lucie Polanská, IČO 03441482, zapsaná v živnostenském rejstříku“ + údaj o DPH (čl. IV tvrdí „je plátcem DPH“ — ověřit) |
| OP čl. IV | Dobírka jako platební metoda | Checkout ji musí mít — jinak smazat |
| Doprava a platba | „Odložená platba PlatímPak — Equa Bank“ | Equa Bank zanikla fúzí s Raiffeisenbank 2022. Smazat (nebo nahradit tím, co ComGate reálně nabízí) |
| Doprava a platba | Dvě sady cen pro CZ (79/95 a 89/99 Kč, „varianta 2“), duplicitní nadpis | Nechat jen ceny z checkoutu; pojmenovat dopravce |
| Doprava a platba vs. OP čl. III | OP: cena dopravy „pouze pro ČR“; stránka má SK ceny | Sjednotit |
| OP čl. VIII | „stížnosti… prostřednictvím elektronické adresy .“ — prázdné | Doplnit info@keramickazahrada.cz |
| Reklamační protokol | „Formulář ještě dokončujeme“ | Nahrát PDF nebo větu smazat |
| Produkt poukaz 1 Kč | Poštovné 60 Kč, e-mail gmail, platba „převodem libovolné částky“ | Viz sekce Poukazy |
| Produkt „Domovní znamení NA ZAKÁZKU“ | Cena 6 000 Kč + „cena dohodou podle složitosti“ | Jedno nebo druhé |
| Stránka Výroba | Odkaz „Zakázková tvorba“ z homepage vede na stránku o procesu, ne na poptávku | Přidat poptávkový formulář dolů na stránku Výroba |
| Patička | Odkaz jen na „Reklamační protokol“ | Pojmenovat „Reklamační řád“ a mít v něm pravidla, ne jen návod |

---

## 7. Technika obchodu (co se řeší v kódu)

Novela 374/2022 Sb. přidala povinnosti, které nejde splnit textem v OP — musí je dělat samotný checkout.

| Povinnost | Zákon | Co udělat v Next.js + Medusa |
| --- | --- | --- |
| Tlačítko objednávky | § 1826a odst. 2 OZ | Nápis „Objednávka zavazující k platbě“ (ne „Objednat“, „Dokončit“). Bez toho je smlouva pro spotřebitele nezávazná. Stejný text do OP čl. III. |
| Potvrzení smlouvy v textové podobě | § 1827 odst. 2 OZ | Potvrzovací e-mail musí obsahovat **celé znění OP** (PDF v příloze), ne jen odkaz. Generovat PDF z aktuální verze OP. |
| Předsmluvní informace před odesláním | § 1820, § 1826 OZ | V posledním kroku shrnout: zboží, cena vč. DPH, doprava, platba, dodací lhůta, poučení o odstoupení (nebo o jeho vyloučení u zakázky / kurzu), kontakt. |
| Žádná předzaškrtnutá políčka | § 1817 OZ | Newsletter, dárkové balení — vždy nezaškrtnuto. |
| Souhlas s OP | praxe + důkaz | Checkbox „Seznámil(a) jsem se s obchodními podmínkami“ s odkazem; uložit verzi OP a čas k objednávce. |
| Slevy — nejnižší cena za 30 dní | § 12a ZOS | U každé zlevněné položky zobrazit nejnižší cenu za posledních 30 dní před slevou. Potřeba historie cen v DB. U unikátních kusů s „důvodem slevy“ (prasklinka) jde o vadu, ne o akci — § 12a neplatí, ale musí být napsáno, že jde o cenu kusu s vadou. |
| Recenze | § 5 ZOS (nekalé praktiky) | Zveřejnit, jak se ověřuje, že recenzi píše skutečný zákazník, a nemazat negativní. Pokud se neověřuje, napsat to. |
| Řazení produktů | § 5 ZOS | U „Doporučené“ řazení uvést, podle čeho. Stačí tooltip. |
| Tlačítko „Odstoupit od smlouvy“ | § 1830a OZ (druhá tlačítková novela) | Transpozice směrnice 2023/2673 měla účinnost 19. 6. 2026; k 16. 7. 2026 byla česká novela ještě v legislativním procesu. Připravit teď: v účtu u objednávky (a v e-mailu pro hosty) tlačítko „Odstoupit od smlouvy“ → formulář s předvyplněnými údaji → tlačítko „Potvrdit odstoupení od smlouvy“ → automatický e-mail s potvrzením, obsahem a časem. Dostupné nepřetržitě 14 dnů od převzetí. |
| Zakázka v checkoutu | § 1820 písm. j) OZ | Flag `custom` na produktu → povinné pole zadání + checkbox poučení o vyloučení odstoupení, uložit do order metadata. |
| Kurzy v checkoutu | § 1837 písm. j) OZ | Checkbox „Beru na vědomí, že u kurzu s pevným termínem nelze odstoupit do 14 dnů; platí storno podmínky.“ |
| Multi-měna / Slovensko | § 1820 OZ | U EUR objednávek ukázat cenu dopravy na SK už v košíku; OP doplnit volbu českého práva (spotřebitel si ponechává ochranu práva svého státu). |
| Archivace smluv | § 1827 OZ | OP tvrdí „smlouva je archivována a není přístupná“. Lepší: objednávka včetně verze OP v účtu zákazníka. |

---

## 8. GDPR a cookies

**OP čl. IX smazat celý.** Odkazuje na zákon 101/2000 Sb., zrušený zákonem 110/2019 Sb., a staví zpracování pro plnění smlouvy na „souhlasu“ — právní základ je plnění smlouvy (čl. 6 odst. 1 písm. b GDPR). Věta „nezvolí-li kupující jinou možnost, souhlasí se zasíláním obchodních sdělení“ je opt-out; GDPR a § 7 zákona 480/2004 Sb. vyžadují opt-in (u stávajících zákazníků lze posílat nabídky vlastních obdobných produktů bez souhlasu, s možností odhlášení v každé zprávě). V OP stačí jedna věta s odkazem na samostatné Zásady.

**Stránka Ochrana osobních údajů** je generická šablona. Má obsahovat konkrétně:

| Účel | Údaje | Právní základ | Doba | Příjemci |
| --- | --- | --- | --- | --- |
| Vyřízení objednávky | jméno, adresa, e-mail, telefon, objednané zboží | plnění smlouvy | 10 let (účetní a daňové doklady) | ComGate, Zásilkovna / Česká pošta / PPL, účetní, hosting |
| Uživatelský účet | e-mail, heslo (hash), historie objednávek, wishlist | plnění smlouvy | do zrušení účtu, max. 3 roky nečinnosti | hosting |
| Reklamace a odstoupení | údaje z objednávky, popis vady, fotografie | právní povinnost / oprávněný zájem | 4 roky (promlčení) | — |
| Newsletter | e-mail, otevření, kliknutí | souhlas (double opt-in) | do odvolání | nástroj na rozesílku (pojmenovat) |
| Zakázková výroba | zadání, fotografie místa, komunikace | plnění smlouvy | 4 roky | — |
| Kurzy | jméno, kontakt, u dětí jméno dítěte a věk | plnění smlouvy | 1 rok po kurzu | — |
| Analytika | cookies, IP | souhlas | dle nastavení cookies | Google (Analytics) |

Doplnit: práva subjektu včetně práva podat stížnost u ÚOOÚ (Pplk. Sochora 27, Praha 7, uoou.gov.cz), hosting a jeho sídlo (pokud mimo EU, uvést), že Lucie nemá DPO.

**Cookies.** Stránka si odporuje: odst. 07 tvrdí „cookies nesbírají žádná osobní data“, odst. 10 přiznává Google Analytics. Od 1. 1. 2022 platí opt-in (§ 89 odst. 3 zákona 127/2005 Sb.). V kódu:

- GA skript se nesmí načíst před kliknutím na „Přijmout“ (Google Consent Mode v2 s výchozím `denied`, nebo skript vložit až po souhlasu).
- Lišta musí mít „Odmítnout vše“ stejně viditelné jako „Přijmout vše“.
- Stránka Cookies má obsahovat tabulku: název cookie, účel, kdo ji nastavuje, doba. Odkaz „Nastavení cookies“ v patičce musí lištu znovu otevřít (dnes je to text bez odkazu).
- Nezbytné cookies (košík, přihlášení, měna) souhlas nepotřebují — vyjmenovat.
- Smazat duplicitní odstavce 01–04 a 07.

---

## 9. Checklist

### V kódu

- [ ] Tlačítko v posledním kroku checkoutu: „Objednávka zavazující k platbě“
- [ ] Potvrzovací e-mail s OP jako PDF přílohou + uložení verze OP k objednávce
- [ ] Flag `custom` na produktu → povinné pole zadání + checkbox o vyloučení odstoupení → order metadata
- [ ] Štítek „Na zakázku — nelze vrátit do 14 dnů“ u ceny na kartě produktu
- [ ] Stejný checkbox pro kurzy (výjimka § 1837 písm. j) + odkaz na storno podmínky
- [ ] Historie cen pro § 12a (nejnižší cena za 30 dní) u zlevněných položek; u kusů s vadou místo toho text „cena kusu s uvedenou vadou“
- [ ] Cookie lišta: GA až po souhlasu, tlačítko Odmítnout, odkaz „Nastavení cookies“ v patičce funkční
- [ ] Produkt poukazu „1 Kč“ nahradit variantami / polem s hodnotou, která se propíše do košíku
- [ ] Připravit flow „Odstoupit od smlouvy“ v účtu a v e-mailu (§ 1830a) — dvoustupňové potvrzení + automatický e-mail
- [ ] Žádné předzaškrtnuté checkboxy v checkoutu
- [ ] Odstranit PlatímPak, sjednotit ceník dopravy s checkoutem, pojmenovat dopravce
- [ ] Doménu v OP a formulářích přepnout při nasazení na keramickazahrada.cz
- [ ] Poptávkový formulář zakázky (stránka Výroba) s povinným souhlasem s OP

### Text — předat Lucii / advokátovi

- [ ] Nové OP: datum, identifikace OSVČ, ověřit plátcovství DPH, číslo účtu, prázdný e-mail v čl. VIII, text tlačítka
- [ ] Nový článek Výroba na zakázku (návrh znění výše)
- [ ] Nový článek Kurzy se storno podmínkami
- [ ] Článek Dárkové poukazy (platnost, nevratnost po uplatnění, nevyplácení)
- [ ] Čl. V Odstoupení přepsat: způsob vrácení, nejlevnější doprava, § 1833, e-mail jako platná forma, nové výjimky
- [ ] Čl. VI/VII: smazat přenos přepravní škody na zákazníka, 6 → 12 měsíců, lhůta od uplatnění reklamace, pořadí nároků, potvrzení o přijetí
- [ ] Čl. VIII: plná informace o ČOI (Štěpánská 796/44, 110 00 Praha 1, coi.cz) jako subjektu mimosoudního řešení sporů; žádný odkaz na platformu ODR (zrušena 20. 7. 2025)
- [ ] Čl. IX smazat, čl. X přepsat
- [ ] Vzorové poučení o odstoupení dle NV 29/2023 Sb. (ve znění NV 66/2026 Sb.) doslova na stránku Odstoupení
- [ ] Stránka GDPR konkrétně podle tabulky výše; stránka Cookies s tabulkou cookies
- [ ] Reklamační řád jako samostatný dokument, PDF protokol
- [ ] Rozhodnout zálohu u zakázky (doporučeno 30–50 %) a storno u kurzů

### Před spuštěním

- [ ] Advokát přečte finální OP
- [ ] Testovací objednávka celým flow včetně odstoupení a refundu přes ComGate
- [ ] Archivované OP 2015 zůstanou dostupné pro starší objednávky z WooCommerce

---

## 10. Zdroje

Auditované stránky (staženy 14. 10. 2026): https://store.matejforejt.com/cz/smluvni-podminky · /odstoupeni-od-smlouvy · /reklamacni-protokol · /doprava-a-platba · /vyroba · /kurzy · /dotazy · /ochrana-osobnich-udaju · /cookies · /store?collection=dárkové-poukazy · /products/domovni-znameni-na-zakazku

Právní rámec:

- Zákon č. 89/2012 Sb., občanský zákoník — § 1810–1867 (spotřebitelské a distanční smlouvy), § 2158–2174 (prodej zboží spotřebiteli)
- Zákon č. 634/1992 Sb., o ochraně spotřebitele — § 12a (slevy), § 14 (mimosoudní řešení sporů), § 19 (reklamace)
- Zákon č. 374/2022 Sb. (novela účinná 6. 1. 2023) — https://www.taylorwessing.com/en/insights-and-events/insights/2023/01/amendment-to-the-czech-consumer-protection-act ; https://www.pravniprostor.cz/clanky/obcanske-pravo/tlacitkova-novela-spotrebitelskeho-prava-prehledny-check-list-novych-povinnosti-e-shopistu
- Nařízení vlády č. 29/2023 Sb. (vzorové poučení a formulář pro odstoupení), ve znění NV č. 66/2026 Sb. — https://www.epravo.cz/top/zakony/sbirka-zakonu/sb/2026/66
- Zrušení platformy ODR k 20. 7. 2025 — https://www.businessinfo.cz/clanky/skoncila-informacni-povinnost-obchodniku-o-platforme-odr/
- Tlačítko pro odstoupení (§ 1830a, směrnice 2023/2673) — https://advokatnidenik.cz/2026/07/16/mobilni-aplikace-i-e-shopy-budou-muset-zavest-tlacitko-k-odstoupeni-od-smlouvy/ ; https://www.epravo.cz/top/clanky/druha-tlacitkova-novela-povinne-tlacitko-pro-odstoupeni-od-smlouvy-121308.html
- Zákon č. 110/2019 Sb., o zpracování osobních údajů; GDPR (2016/679); zákon č. 127/2005 Sb., § 89 odst. 3 (cookies); zákon č. 480/2004 Sb., § 7 (obchodní sdělení)
