# Otevřené otázky pro Lucii (a advokáta)

Každá položka je v textech vyznačená jako zvýrazněné `[[DOPLNIT: …]]`. **Od 15. 10. se údaje
(`{{…}}`) doplňují v administraci obchodu → „Právní údaje“** (stránka ukáže, co chybí; uloží se
do `merchant_settings.legal_facts`, web i e-maily je čtou živě). `storefront/src/lib/legal/facts.ts`
je už jen záloha pro výpadek backendu. Text, který není údajem (formulace článků), se upravuje ve
Studiu → „Právní dokumenty“ (pracovní znění). Po doplnění znění vydat (`pnpm legal:build` +
`pnpm legal:upload`, viz `docs/legal/00-plan.md` §6). Nic z toho se nesmí doplnit odhadem.
Zpráva pro Lucii s otázkami srozumitelně: `docs/legal/ZPRAVA_PRO_LUCII.md`.

## Údaje o prodávající

| # | Otázka | Kde se projeví | Poznámka |
| --- | --- | --- | --- |
| 1 | **Číslo bankovního účtu** pro texty (a vracení peněz převodem) | OP čl. Cena a platba, Doprava a platba | Staré OP uváděly 2500675505/2010 (CZK) a 2701281289/2010 (EUR), stará stránka Doprava 7010757121/2010 (IBAN CZ34 2010 0000 0070 1075 7121; natvrdo zapsané výchozí hodnoty z `lib/data/merchant.ts` jsou odstraněné, proměnná `CISLO_UCTU` v prostředí storefrontu se už nikde nepoužívá). Který platí? Doplnit do `facts.ts` → `bank.account`. |
| 2 | **Plátce DPH ano/ne** | OP čl. Cena a platba, souhrny cen | Kód obchodu (`storefront/src/lib/util/dph.ts`: `PLATCE_DPH = false`, komentář „plátcem DPH není“) i iDoklad dnes počítají s neplátcem; staré OP tvrdí „je plátcem DPH“. Potvrdit. |
| 3 | **Datum účinnosti** nových dokumentů | Všechny dokumenty, názvy PDF | Pracovně 15. 10. 2026. Nastavit na skutečné datum spuštění na keramickazahrada.cz: přejmenovat soubory verzí v `storefront/src/lib/legal/documents/*/2026-10-15.ts` (a `version` v nich), datum je i v textu OP čl. XVII, Reklamačního řádu čl. 12 a Zásad `#zmeny`; pak `pnpm legal:build` + `pnpm legal:upload`. |
| 3a | Dodací lhůta zboží skladem | Pokladna (předsmluvní informace), OP čl. VII | Převzato z dosavadní stránky Doprava a platba: „předáváme dopravci zpravidla do 2 pracovních dnů od přijetí platby (u dobírky od objednávky), doručení obvykle 1 až 3 pracovní dny“ (`facts.ts` → `delivery.dispatchTime`). Potvrdit. |
| 3b | Doména pro PDF | Patička, e-maily | Finální PDF jsou v R2 na `https://img.matejforejt.com/legal/…`. Při přechodu na keramickazahrada.cz zvážit vlastní doménu bucketu (pak `R2_PUBLIC_URL` a znovu `pnpm legal:upload` — URL se přepíšou v manifestech). |

## Zakázková výroba

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 4 | **Výše zálohy** (% z ceny) | OP čl. Výroba na zakázku, FAQ | Doporučeno 30–50 %. Systém dnes zálohu bere podle profilu výroby u produktu. |
| 5 | Produkty s „NA ZAKÁZKU“ v názvu bez profilu výroby | Katalog | 27 produktů má „na zakázku“ v názvu, profil výroby (a tím poučení o vyloučení odstoupení, zálohu a povinné zadání) má jen 1. Ostatní se prodávají jako běžné zboží **s právem odstoupit**. Rozhodnout, které jsou skutečně na míru, a zapnout jim profil v administraci (Produkty → Výroba). |
| 6 | „Domovní znamení NA ZAKÁZKU“ 6 000 Kč + „cena dohodou“ | Produkt v administraci | Buď pevná cena za standardní rozsah, nebo produkt bez ceny s odkazem na poptávku (nový formulář na stránce Výroba, kotva `/vyroba#poptavka`). |
| 6a | Pravidla zakázky navržená v OP (potvrdit) | OP čl. IX | Fotografie před výpalem: bez odpovědi do 5 pracovních dnů = schváleno (z auditu); nezaplacený doplatek 30 dnů po výzvě → můžeme odstoupit a ponechat si skutečné náklady, nejvýš zálohu; dodatečné odstoupení při zpoždění výroby se zálohou vrácenou celou. |

## Kurzy

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 7 | **Storno podmínky kurzů** | OP čl. Kurzy, stránka Kurzy, rezervace, e-mail | Doporučeno: 7 a více dní předem 100 %, 2–6 dní 50 % nebo přesun, méně než 48 h 0 % (lze poslat náhradníka). **Systém dnes:** zákazník zruší online do 48 h před začátkem a dostane 100 % automaticky; později jen telefonicky. Buď potvrdit dnešní pravidlo, nebo dodat nové (pak se upraví i automatický refund). Text se doplňuje na **jednom** místě: administrace → Právní údaje → `course.cancellation` (web, PDF i e-mail potvrzení rezervace). |
| 8 | Minimální věk dítěte na kurzu | OP čl. Kurzy | — |
| 9 | Do kdy si vyzvednout výrobek z kurzu po výpalu | OP čl. Kurzy | — |

## Dárkové poukazy

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 10 | **Platnost poukazu** | OP čl. Dárkové poukazy, produkty poukazů | Dnes uváděn 1 rok jen u „volné“ varianty. |
| 11 | Zůstatek při nákupu pod hodnotu poukazu — propadá, nebo zůstává na kódu? | OP čl. Dárkové poukazy | — |
| 12 | Jak se poukaz uplatňuje? | OP, FAQ | V obchodě neexistuje systém dárkových karet ani kreditu — poukaz je běžný produkt. Uplatnění je dnes zjevně ruční (kód / domluva). Popsat skutečný postup. |
| 13 | Produkt „Dárkový poukaz … 1 Kč“ (jen v produkční DB) | Administrace | Kód nově umí poukaz s vlastní hodnotou, která se propíše do košíku. Produkt je potřeba přepnout skriptem `npx medusa exec ./src/scripts/legal-voucher-product.ts` (výchozí je suchý běh; `-- --apply` zapíše) a v administraci odstranit z popisu „poštovné 60 Kč“, soukromý e-mail a pokyn „převeďte libovolnou částku“ (skript tyto řádky vypíše, sám popis nemění). |
| 13a | Meze poukazu s vlastní částkou | Produkt (metadata) | Výchozí v kódu: od 100 do 10 000 Kč po 100 Kč, jen v CZK (SK/EUR košík poukaz s vlastní částkou koupit nemůže). Potvrdit / upravit přes `--min/--max/--step` ve skriptu. |
| 13b | Poukazy a slevové kódy | Administrace (Produkty+ → „Bez slev. kódů“) | OP říká, že na koupi poukazu nelze uplatnit slevový kód — u produktů poukazů je potřeba zapnout „Bez slev. kódů“ (`no_promo`). |
| 13c | Vrácení peněz za nákup placený poukazem | OP čl. XI | Navrženo: vrátíme poukazem se stejnou platností. Potvrdit. |

## Zásady ochrany osobních údajů

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 14 | Nástroj na rozesílku newsletteru | Zásady OÚ | Vlastní modul newsletteru v backendu posílá kampaně přes e-mailovou službu obchodu (Resend) — potvrdit, že se nepoužívá jiný nástroj. |
| 15 | ~~Hosting a jeho sídlo~~ **VYŘEŠENO 16. 10.** | Zásady OÚ | Ověřeno: Railway (europe-west4, Amsterdam; Railway Corporation, USA; DPF), Cloudflare R2 (EU jurisdikce), Supabase (Frankfurt; Supabase Pte. Ltd., Singapur; SCC), Resend (Plus Five Five, Inc.; odesílání eu-west-1, metadata USA; DPF + SCC). Fakt `privacy.hosting` vyplněný, logy hostingu 7 dní (Hobby). Zbývá: podepsat Railway DPA (DocuSign) a nasadit CMS proměnné na Railway Storefront (00-plan §6 4b). |
| 16 | Účetní / daňový poradce jako příjemce údajů | Zásady OÚ | Jméno nebo jen kategorie „účetní“. |
| 16a | **Segment (Twilio, USA)** | Zásady OÚ `#prijemci` | Backend při každé objednávce posílá událost do Segmentu, je-li nastaven `SEGMENT_WRITE_KEY` (lokální `.env` ho má). E-mail a jméno už se neposílají (opraveno), zůstává číslo objednávky, částka, položky a interní ID zákazníka. Rozhodnout: Segment vypnout (smazat proměnnou), nebo ho uvést v Zásadách jako příjemce včetně předání do USA. |
| 16b | ~~Předání mimo EU/EHP~~ **VYŘEŠENO 16. 10.** | Zásady OÚ `#mezinarodni-prenosy` | Sekce vypsaná po službách (Railway, Cloudflare, Resend, Supabase, Google) se základem DPF / SCC; zdroje v reportu z 16. 10. (DPF registr, DPA poskytovatelů, DNS). Advokát ať potvrdí. Volitelně doplnit Websupport (schránka info@). |
| 16c | Doby uchování navržené v Zásadách | Zásady OÚ | Poptávky a kontaktní dotazy 1 rok od poslední zprávy; zrušení nepoužívaného účtu po 3 letech s předchozím upozorněním; technické záznamy hostingu `[[DOPLNIT]]`. Potvrdit. |
| 16d | E-maily bez výslovného souhlasu | Zásady OÚ | Žádost o recenzi po doručení, upozornění na zlevnění výrobku v oblíbených a připomínka opuštěného košíku (úloha je dnes vypnutá) jsou v Zásadách vedené jako oprávněný zájem s právem námitky. Advokát ať posoudí, zda nejde o obchodní sdělení vyžadující souhlas (§ 7 zákona č. 480/2004 Sb.). |

## Odstoupení a reklamace

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 17 | Odhad nákladů na vrácení zboží poštou | Odstoupení, OP | § 1820 odst. 1 písm. i) OZ. |
| 17a | Doprava při částečném odstoupení | Online odstoupení, e-mail potvrzení | Systém slibuje vrácení nákladů na dodání (ve výši nejlevnější nabízené dopravy) jen při odstoupení od **celé** smlouvy; při odstoupení jen od části zboží se doprava nevrací. Advokát ať potvrdí. |
| 17b | Přepravní poškození — obrat proti 12. 10. | Texty, e-maily | Podle auditu §4.1 škodu u dopravce řeší prodávající; zákazníkovi už nic neukládáme (dřívější rozhodnutí z 12. 10. „reklamuje příjemce u České pošty“ je zrušené). Lucie potřebuje vědět, že reklamaci u ČP podává ona (2 pracovní dny od doručení — admin ji na to upozorní). |
| 17c | Mrazuvzdornost | Produkty, kartička k zásilce | OP vylučuje z vad prasklinu nádoby na vodu, ve které zamrzla voda, **jen pokud** byl zákazník upozorněn u výrobku i na kartičce v balíku. Doplnit upozornění k dotčeným produktům a na kartičku. |
| 17d | Balné na stránce výrobku | Produkt | Povinné balné se dnes ukazuje až v košíku. Advokát ať posoudí, zda stačí (§ 1811 odst. 2 OZ, cena včetně všech poplatků), nebo ho uvádět u ceny výrobku. |

## Další rozhodnutí

| # | Otázka | Poznámka |
| --- | --- | --- |
| 18 | Mají se používat Google Analytics? | Dnes se žádná analytika nenačítá. Kód je připravený: GA se zapne nastavením `NEXT_PUBLIC_GA_MEASUREMENT_ID` a načte se jen po souhlasu. Bez proměnné se nic nenačte. |
| 19 | Pravidla moderace recenzí | Text u recenzí slibuje, že se nemažou negativní hodnocení — potvrdit, že tak Lucie postupuje. |
| 20 | Reklama na webu | Lišta cookies u marketingové kategorie říká „Reklamu na webu zatím neprovozujeme“ — potvrdit. |
| 21 | Zásilkovna v pokladně | Kód pokladny umí výdejní místa Zásilkovny (widget Packeta), backend ji vede jako starší dopravce. Používá se ještě? Pokud ne, vyřadit ze soupisu cookies a ze Zásad. Ověřit i obchodní firmu („Zásilkovna s.r.o.“ / Packeta). |
| 22 | Obsah v CMS mimo právní stránky | Produkční CMS (Studio) | FAQ ve Studiu má dvě zastaralé odpovědi: „Jak postupovat, když zásilka dorazí poškozená?“ („ozvěte se nám do 48 hodin“) a „Mohu produkt vrátit nebo vyměnit?“ („Nepoužitý výrobek … do 14 dnů“ — podmínku „nepoužitý“ zákon nezná, § 1833 OZ). **Kód odpovědi na tato dvě témata přebíjí vždy** (`storefront/src/lib/legal/faq.ts` → `PINNED_FAQ_ANSWERS`, párování podle tématu otázky), takže zákazník vidí znění, které sedí s OP, a úprava těchto dvou odpovědí ve Studiu se na webu neprojeví. (15. 10. zkoušeno pouštět text ze Studia, „dokud není chybný“ — kontrola ukázala, že jiné chybné formulace by prošly, proto zpět na trvalé přišpendlení.) Text ve Studiu přesto opravit, ať redakce a web neříkají každý něco jiného. Totéž texty o kurzech v CMS („předem kartou, nebo na místě“) — ověřit, že sedí s podmínkami. |
| 23 | Platba při osobním odběru | OP čl. V | OP uvádí jen hotovost (podle backendu `pickupPayment`). Pokud lze platit i kartou na místě, doplnit. |
| 24 | Nastavení Google Analytics | Railway | Pokud ano: `NEXT_PUBLIC_GA_MEASUREMENT_ID` ve storefrontu (zapéká se při buildu → nový build) a v GA4 zapnuté „rozšířené měření → změny stránky podle historie“. |
| 25 | **Produkty „… - SLEVA“ bez akční ceny** | Katalog | „Zvonkové tlačítko Paví mini - SLEVA“, „Klasik - Smetana - SLEVA“, „Retro, Smetana - SLEVA“ a kolekce „Výrobky se slevou“ ohlašují slevu, ale prodávají za běžnou cenu bez předchozí ceny (§ 12a ZOS). Buď slevu nastavit jako akční ceník (Slevy+ / price list — pak web sám ukáže nejnižší cenu za 30 dní), nebo „SLEVA“ z názvů, popisů a kolekce odstranit. Pokud jde o kusy s vadou, převést je na „kus s vadou“ (Poškozené). |
| 26 | Testovací kus v produkci | Katalog | „Keramická kytka bílá, modrý střed — poškozený“ s popisem vady „TEST“ je zveřejněný — skrýt, nebo doplnit skutečnou vadu. |
| 27 | Upozornění na zlevnění v oblíbených — komu | Úloha watch-price-drops | § 7 odst. 3 zák. 480/2004 Sb. míří na kontakty získané v souvislosti s prodejem; v oblíbených může mít výrobek i někdo, kdo nikdy nenakoupil. Advokát ať rozhodne: posílat jen zákazníkům s dokončenou objednávkou, nebo si u oblíbených vyžádat souhlas. (Připomínka košíku zůstává vypnutá.) Pozn.: e-maily o zlevnění se kvůli § 12a začnou posílat až ve chvíli, kdy historie cen pokryje 30 dní (měsíc po nasazení). |
| 28 | Reklamační řád 2026-10-15 — „kolekce Poškozené“ | Reklamační řád čl. „Co není vadou“ | V obchodě je to filtr, ne kolekce. Text už nahraného (neměnného) PDF se nemění; opravit při přejmenování verze na skutečné datum spuštění (#3). |
