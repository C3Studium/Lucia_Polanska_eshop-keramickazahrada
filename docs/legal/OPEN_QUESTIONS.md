# Otevřené otázky pro Lucii (a advokáta)

Každá položka je v textech vyznačená jako zvýrazněné `[[DOPLNIT: …]]` a údaj se doplňuje na
jednom místě: `storefront/src/lib/legal/facts.ts` (pak `pnpm legal:build`, aby se obnovila PDF).
Nic z toho se nesmí doplnit odhadem.

## Údaje o prodávající

| # | Otázka | Kde se projeví | Poznámka |
| --- | --- | --- | --- |
| 1 | **Číslo bankovního účtu** pro texty (a vracení peněz převodem) | OP čl. Cena a platba, Doprava a platba | OP uvádí 2500675505/2010 (CZK) a 2701281289/2010 (EUR), stránka Doprava 7010757121/2010 (`lib/data/merchant.ts`, IBAN CZ34 2010 0000 0070 1075 7121). Který platí? |
| 2 | **Plátce DPH ano/ne** | OP čl. Cena a platba, souhrny cen | Kód obchodu (`storefront/src/lib/util/dph.ts`: `PLATCE_DPH = false`, komentář „plátcem DPH není“) i iDoklad dnes počítají s neplátcem; staré OP tvrdí „je plátcem DPH“. Potvrdit. |
| 3 | **Datum účinnosti** nových dokumentů | Všechny dokumenty, názvy PDF | Pracovně 15. 10. 2026. Nastavit na skutečné datum spuštění na keramickazahrada.cz. |

## Zakázková výroba

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 4 | **Výše zálohy** (% z ceny) | OP čl. Výroba na zakázku, FAQ | Doporučeno 30–50 %. Systém dnes zálohu bere podle profilu výroby u produktu. |
| 5 | Produkty s „NA ZAKÁZKU“ v názvu bez profilu výroby | Katalog | 27 produktů má „na zakázku“ v názvu, profil výroby (a tím poučení o vyloučení odstoupení, zálohu a povinné zadání) má jen 1. Ostatní se prodávají jako běžné zboží **s právem odstoupit**. Rozhodnout, které jsou skutečně na míru, a zapnout jim profil v administraci (Produkty → Výroba). |
| 6 | „Domovní znamení NA ZAKÁZKU“ 6 000 Kč + „cena dohodou“ | Produkt v administraci | Buď pevná cena za standardní rozsah, nebo produkt bez ceny s poptávkou (formulář na stránce Výroba). |

## Kurzy

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 7 | **Storno podmínky kurzů** | OP čl. Kurzy, stránka Kurzy, rezervace, e-mail | Doporučeno: 7 a více dní předem 100 %, 2–6 dní 50 % nebo přesun, méně než 48 h 0 % (lze poslat náhradníka). **Systém dnes:** zákazník zruší online do 48 h před začátkem a dostane 100 % automaticky; později jen telefonicky. Buď potvrdit dnešní pravidlo, nebo dodat nové (pak se upraví i automatický refund). |
| 8 | Minimální věk dítěte na kurzu | OP čl. Kurzy | — |
| 9 | Do kdy si vyzvednout výrobek z kurzu po výpalu | OP čl. Kurzy | — |

## Dárkové poukazy

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 10 | **Platnost poukazu** | OP čl. Dárkové poukazy, produkty poukazů | Dnes uváděn 1 rok jen u „volné“ varianty. |
| 11 | Zůstatek při nákupu pod hodnotu poukazu — propadá, nebo zůstává na kódu? | OP čl. Dárkové poukazy | — |
| 12 | Jak se poukaz uplatňuje? | OP, FAQ | V obchodě neexistuje systém dárkových karet ani kreditu — poukaz je běžný produkt. Uplatnění je dnes zjevně ruční (kód / domluva). Popsat skutečný postup. |
| 13 | Produkt „Dárkový poukaz … 1 Kč“ (jen v produkční DB) | Administrace | Kód nově umí poukaz s vlastní hodnotou, která se propíše do košíku. Produkt je potřeba přepnout skriptem `backend/src/scripts/legal-voucher-product.ts` (nebo v administraci) a odstranit z popisu „poštovné 60 Kč“ a soukromý e-mail. |

## Zásady ochrany osobních údajů

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 14 | Nástroj na rozesílku newsletteru | Zásady OÚ | Vlastní modul newsletteru v backendu posílá kampaně přes e-mailovou službu obchodu (Resend) — potvrdit, že se nepoužívá jiný nástroj. |
| 15 | Hosting a jeho sídlo | Zásady OÚ | Technicky: Railway (aplikace a databáze), Cloudflare R2 (soubory), Supabase (obsah webu), Resend (e-maily). Potvrdit regiony / smluvní stranu. |
| 16 | Účetní / daňový poradce jako příjemce údajů | Zásady OÚ | Jméno nebo jen kategorie „účetní“. |

## Odstoupení a reklamace

| # | Otázka | Kde | Poznámka |
| --- | --- | --- | --- |
| 17 | Odhad nákladů na vrácení zboží poštou | Odstoupení, OP | § 1820 odst. 1 písm. i) OZ. |

## Další rozhodnutí

| # | Otázka | Poznámka |
| --- | --- | --- |
| 18 | Mají se používat Google Analytics? | Dnes se žádná analytika nenačítá. Kód je připravený: GA se zapne nastavením `NEXT_PUBLIC_GA_MEASUREMENT_ID` a načte se jen po souhlasu. Bez proměnné se nic nenačte. |
| 19 | Pravidla moderace recenzí | Text u recenzí slibuje, že se nemažou negativní hodnocení — potvrdit, že tak Lucie postupuje. |
