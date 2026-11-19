# Česká pošta – na adresu zahraničí: plán

Podklady k implementaci. Sepsáno 19. 11. 2026, data stažená týž den. Kód podle
tohohle plánu ještě nikdo nenapsal; rozdělaná práce je popsaná v oddílu 8.

## 1. Cíl

Nová doprava **„Česká pošta – na adresu zahraničí“** pro země mimo Česko.

- Cena se počítá jako u České pošty: podle země, služby a hmotnosti zásilky.
- Hmotnost se sečte z výrobků v košíku (`product.weight`, gramy). Majitelka ji
  postupně doplní u výrobků sama.
- Když hmotnost nemají všechny výrobky v košíku, použije se **průměrná váha
  balíku do zahraničí** z Nastavení obchodu.
- Ceny pocházejí z kalkulačky České pošty. Její rozhraní je zkopírované
  „jedna ku jedné“ do vlastního engine nad staženou tabulkou.

## 2. Co je ověřené

| Fakt | Jak ověřeno |
|---|---|
| B2B API České pošty (nAPI) cenu **nevrací** — ani výpočtem, ani po podání. | Prošlé všechny specifikace na <https://www.postaonline.cz/dokumentaceapi/b2b> (ZSK 1.14.0, ZSKS, CIS, CSG, BOX, EXO, POZR, PROV). Pole `price` je jen v POZR, a tam ho posílá podavatel. |
| Ceny má jen veřejná kalkulačka <https://www.postaonline.cz/kalkulacka-postovneho>. Bere je z JSON endpointů, které jdou volat přímo, bez cookies a bez prohlížeče. | Odchyceno z prohlížeče a zopakováno curlem/fetch (oddíl 4). |
| Staženo 239 zemí × všechny váhy, 0 neúspěšných dotazů. ČP vozí balík do 187 zemí; do 52 zemí teď ne. | `cp-ceny-zahranici.full.json` |
| Výrobky mají hmotnost v **gramech** v `product.weight`. Editace je v Produkty+ (řádek „…“ i hromadné změny) od 19. 11. | `admin/components/product-row-more.tsx:245`, `product-bulk-drawer.tsx:150` |
| Dopravce ČP dnes sčítá **`variant.weight`**, ne `product.weight`. Když hmotnost nemá nic, použije 2,5 kg. | `modules/ceskaPostaFulfillment/service.ts` → `parcelWeight()` |
| `calculatePrice` dostane z kontextu `product_id` položek, ale ne jejich hmotnost ani měnu košíku. | Komentář v `service.ts` u `calculatePrice`; chování Medusy ověřené 28. 10. 2026. |
| Obchod prodává mimo Česko jen do regionu **Europe (EUR)**: pl, sk, si, dk, fr, de, it, es, se, gb. Region „Polsko“ (PLN) je prázdný. | `GET /store/regions` |

## 3. Podklady v této složce

| Soubor | Co to je |
|---|---|
| `cp-ceny-zahranici.json` | **Data pro engine** (230 kB). Formát `countries[iso2].products[služba] = [[do_kg, cena_s_DPH, cena_bez_DPH], …]` vzestupně podle `do_kg`. Má i `fetched_at`, `services`, `query` a `note`. |
| `cp-ceny-zahranici.full.json` | Totéž v plném tvaru, s `productId`, `transactionCode`, `url` a `weightsOffered` (2 MB). |
| `stahni.mjs` | Stahovač, který obojí vyrobil: `node stahni.mjs vystup.json [--countries=DE,AT]`. Pouští 4 souběžné dotazy, trvá ~20 min, umí navázat z `.partial`. |
| `ukazky/countries.json` | Odpověď `countries` (kód → český název). |
| `ukazky/sizes.json` | Odpověď `sizes` (S/M/L/XL, jen pro tuzemsko). |
| `ukazky/weights-DE-balik.json` | Odpověď `weights` pro balík do Německa (0,5 a 1–30 kg). |
| `ukazky/consignments-DE-3kg.json` | Celý dotaz a celá odpověď výpočtu (balík do DE, 3 kg). |

Ceny ze 19. 11. 2026, balík bez pojištění a bez doplňkových služeb. Pro deset zemí
obchodu, s DPH v Kč (2 / 5 / 10 kg, v závorce nejvyšší váha):

| Země | Std. prioritní | Std. ekonomický | Obchodní balík | EMS |
|---|---|---|---|---|
| SK | 416 / 589 / 877 (20) | — | 315 / 333 / 363 (30) | 375 / 393 / 423 (30) |
| PL | 383 / 520 / 749 (20) | 353 / 480 / 691 (20) | 702 / 823 / 1065 (30) | 411 / 484 / 605 (20) |
| DE | 416 / 589 / 877 (30) | 384 / 544 / 810 (30) | 702 / 823 / 1065 (30) | 968 / 1149 / 1391 (30) |
| SI | 645 / 956 / 1475 (30) | 595 / 882 / 1361 (30) | — | 847 / 1028 / 1331 (30) |
| DK | 645 / 956 / 1475 (20) | 595 / 882 / 1361 (20) | 702 / 823 / 1065 (30) | 1089 / 1452 / 2057 (30) |
| FR, IT | 645 / 956 / 1475 (30) | 595 / 882 / 1361 (30) | 786 / 932 / 1174 (30) | 1089 / 1452 / 2057 (30) |
| ES | 645 / 956 / 1475 (30) | 595 / 882 / 1361 (30) | 871 / 1016 / 1258 (30) | 1089 / 1452 / 2057 (20) |
| SE | 645 / 956 / 1475 (20) | 595 / 882 / 1361 (20) | 786 / 932 / 1174 (30) | 1089 / 1452 / 2057 (30) |
| GB | 645 / 956 / 1475 (30) | 595 / 882 / 1361 (30) | 650 / 770 / 970 (30) | 900 / 1200 / 1700 (30) |

Obchodní balík je s DPH 21 %, ostatní mezinárodní služby jsou od DPH osvobozené.

## 4. Kalkulačka ČP — přesná kopie rozhraní

Tohle je to, co dělá formulář na postaonline.cz. Engine má umět totéž: buď
nad staženou tabulkou, nebo živě stejnými dotazy.

**Základ všech volání** (Liferay resource URL; parametry mají prefix namespace):

```
BASE = https://www.postaonline.cz/kalkulacka-postovneho?p_p_id=calcsspconsignment_WAR_calcsspportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1&p_p_resource_id=
NS   = _calcsspconsignment_WAR_calcsspportlet_
```

Hlavičky: `X-Requested-With: XMLHttpRequest` a `Accept: application/json`.
Běžný User-Agent prohlížeče. Cookies nejsou potřeba.

| resource_id | Metoda | Parametry | Odpověď |
|---|---|---|---|
| `countries` | GET | — | `{ "AF": "Afghánistán", … }` |
| `sizes` | GET | — | `{ "S": "do 35 cm (velikost S)", … }` (jen CZ) |
| `weights` | GET | `NS+targetCountry=DE`, `NS+type=1` | `{ "0.5": "do 500 g", "1.0": "do 1 kg", … "30.0": "do 30 kg" }` |
| `consignments` | POST (tělo `{}`) | `NS+data=<JSON formuláře>` | `{ writingProducts[], parcelProducts[], expressProducts[] }` |
| `consignmentsService` | POST | `NS+data={"requestData": {produkt + zvolené doplňkové služby}, "form": <formulář>}` | jeden produkt přepočtený s doplňkovými službami |

**Formulář pro `consignments`** (tvar odchycený z prohlížeče, beze změny):

```json
{ "type": 1, "targetCountry": "DE", "size": null, "weight": "3.0",
  "insuranceAmount": 1, "length": "", "width": "", "height": "", "dimensions": "",
  "weightUnits": "1", "insurance": "0", "confirmation": true,
  "hasCustomerCard": false, "nonStandard": false, "eData": false, "dimensionsUnits": "1" }
```

- `type`: 1 = ostatní zásilky (balíky), 2 = psaní.
- `weight`: klíč z `weights` (řetězec, `"3.0"`).
- `weightUnits`: `"1"` = kg (`"0"` = g).
- `insurance`: `"0"` = bez pojištění; `"2"` = s pojištěním, pak přibude i Cenný balík.
- `dimensionsUnits`: `"1"` = cm.
- Hodnoty enumů jsou z kódu kalkulačky: `KILOGRAMS: Symbol.for(1)`, `GRAMS: 0`, `WITH: 2`, `WITHOUT: 0`, `CENTIMETERS: 1`.

**Z produktu v `parcelProducts` stačí tahle pole:**
- `productName`, `productId`, `transactionCode`;
- `roundedPriceWithVat` (to platí zákazník), `roundedPriceWithoutVat`;
- `priceZoneId`, `linkUrl`;
- `additionalServices` (doplňkové služby s cenami).

Chybový tvar je `400 {"error":[{"value":"…","key":"error0"}],"validation":false}`.
„Vašemu zadání neodpovídá žádný z produktů České pošty!“ znamená, že do země nic nejede.

**Pozor:** je to neveřejné rozhraní za ochranou proti botům (F5). ČP ho může
kdykoli změnit nebo zablokovat. V pokladně se proto **nesmí volat živě**.
Zdroj kódu kalkulačky: `/calcssp-portlet/js/dist/app.js` + chunky
`<hash>.<n>.<n>.app.js`; logika je v chunku 20 (`sendData`), formulář v 34,
doplňkové služby v 32/33.

## 5. Engine

Navržené umístění je `backend/src/lib/cp-kalkulacka/`:

- `data.ts`: tabulka z `cp-ceny-zahranici.json`, generovaná skriptem jako TS
  konstanta, ne import `.json`. Build Medusy jinak `.json` nemusí přibalit.
- `index.ts`, čisté funkce bez Medusy:
  - `cpServices(): string[]`.
  - `cpPriceCzk(country, service, weightKg): number | null`. Vrací cenu prvního stupně, kde `do_kg >= weightKg`, tedy 2,6 kg → „do 3 kg“. Nad nejvyšším stupněm vrací `null`.
  - `cpQuote(country, service, weightKg): { price_czk, service, up_to_kg } | null`. Když zvolená služba do země nejede nebo nebere takovou váhu, zkusí náhradní v pořadí: Std. prioritní → Std. ekonomický → Obchodní balík → EMS. Příklad: SK nemá ekonomický a prioritní tam končí na 20 kg.
- `backend/scripts/cp-kalkulacka-stahni.mjs`: `stahni.mjs` z téhle složky, který rovnou zapisuje `data.ts`. Spouští se ručně po změně ceníku ČP (typicky k 1. 1.) a pak se commitne.
- Volitelně `liveQuote()` se stejnými dotazy jako oddíl 4. Jen pro admin, třeba tlačítko „Ověřit cenu u ČP“ nebo hlídání, že se ceník změnil. Nikdy v pokladně.
- Jednotkové testy: hranice stupňů (0,5 / 1 / 2,6 / 30 / 30,1), náhradní služba (SK ekonomický, SK prioritní 25 kg), neznámá země.

Rozpracovaná verze: `backend/src/lib/cp-ceny-zahranici.ts` ve worktree (oddíl 8).

## 6. Hmotnost zásilky

Pravidlo podle zadání:

1. Projdou se jen položky výrobků. Balné, doběrečné a další servisní řádky se přeskočí přes `isServiceLine` (`lib/packaging-lines`).
2. Hmotnost výrobku = `product.weight` (g). Když chybí, zkusí se `variant.weight`.
3. **Mají-li hmotnost všechny výrobky:** `Σ(g × počet) / 1000` + hmotnost obalu.
4. **Jinak** se použije `international_parcel_weight_kg` z Nastavení obchodu.

Implementační body:
- `calculatePrice` hmotnost v kontextu nedostane. Načíst ji `query.graph({ entity: "product", fields: ["id","weight","variants.id","variants.weight"], filters: { id: [...] } })` podle `product_id` položek.
- **Obal:** výrobek v gramech je bez krabice a výplně. Navrhuju nastavení `international_packaging_kg`, výchozí 1 kg, přičítané jen ve větvi 3. Rozhodnutí v oddílu 9.
- **Nad nejvyšší váhou** (20/30 kg podle země a služby): volbu v pokladně nenabídnout a ukázat větu „Takhle těžký balík do zahraničí neposíláme, napište nám“. Dělení do více balíků je mimo rozsah.
- **Srovnat i tuzemský `parcelWeight()`** v `service.ts`, aby četl `product.weight` stejně. Dnes čte jen `variant.weight` a hmotnost z Produkty+ by nepoznal.

## 7. Nová doprava „Česká pošta – na adresu zahraničí“

Kostra už existuje ve stashi (oddíl 8). Pozor na jeden rozdíl: stash měl pevnou
cenu za zemi, uloženou předem přepočtenou v datech volby. Teď cena závisí na
košíku, takže se počítá až v `calculatePrice`:

1. **Volba a zóna:** jedna volba dopravy `name: "Česká pošta – na adresu zahraničí"`.
   - `price_type: "calculated"`, poskytovatel `ceska-posta-fulfillment`.
   - `data: { international: true, service_code: "INT", … }`.
   - Ve vlastní servisní zóně „Zahraničí“ pod stejnou sadou plnění jako tuzemská ČP.
   - Geo zóny = povolené země. Zakládá se při prvním uložení v adminu (`ensureInternationalOption` ze stashe).
2. **`calculatePrice` (větev `international`):**
   - země z `context.shipping_address.country_code` → hmotnost podle oddílu 6;
   - `cpQuote(země, služba z nastavení, kg)` → cena v Kč;
   - pak případná ruční cena majitelky pro zemi (přepisuje tabulku);
   - převod do měny regionu země.
   - Medusa měnu košíku nepředává, ale země patří do jednoho regionu. Proto do dat volby ukládat `currency_by_country` a `rates` (lístek ČNB). Denně je obnovuje `jobs/sync-currency-prices.ts`, stash na to má `refreshInternationalShippingRates`. Převod přes `convertFromCzk` z `lib/cnb-rates`.
   - Bez ceny vyhodit chybu. Volba pak v pokladně zmizí; je to lepší než naúčtovat špatnou částku.
3. **Podání:** do zahraničí se přes nAPI nepodává. `createFulfillment` vrátí `mode: "manual"`, `international: true` a `weight_kg`; stash to má hotové. Štítek ČP se pro zahraničí neukazuje a label route ho odmítne.
4. **Pokladna (storefront):**
   - dobírka do zahraničí nikdy;
   - Balíkovna jen v CZ;
   - volba povolená i pro křehké kusy a zakázky (`isInternationalShippingOption` ve stashi);
   - firma ze zahraničí s cizím IČO/DIČ (`firma.ts` ve stashi);
   - PSČ bez číselné klávesnice mimo CZ;
   - expresní pokladna má stejná pravidla.
5. **Mimo EU — Velká Británie:** GB je v regionu Europe, ale balík tam potřebuje celní prohlášení (CN22/CN23). Do první verze ho z povolených zemí **vynechat**. Celní údaje umí nAPI (`letterWithCN22`, CIS `customsContent`), ale to je samostatná práce.

## 8. Co převzít

- **`git stash@{0}`** („zahranici-2026-10-28 …“, 21 souborů) obsahuje:
  - volbu, zónu, převod ČNB, ruční podání a admin sekci s cenou po zemích;
  - úpravy pokladny (firma, dobírka, křehké/zakázky, filtr měny v obchodě).
- **Worktree `C:\Users\ADMIN\AppData\Local\Temp\claude\8d6486bb6074ccad\98defc62-5825-432e-aa5f-298c0ea70184\scratchpad\wt-zahranici`**, větev `feat/zahranici-cenik-cp` z `origin/main` (af333368). Necommitnuto.
  - Stash je tam aplikovaný a **všech 11 konfliktů s dnešním main vyřešených**.
  - Duplicitní `country-name.ts` je smazaný; použity jsou `countryNameCs` a `countryEndonym` z main.
  - V `merchant-settings.ts` jsou přidané klíče `international_parcel_weight_kg` (výchozí 3) a `international_cp_service` (výchozí Std. prioritní).
  - Rozpracovaný `lib/cp-ceny-zahranici.ts` importuje ještě neexistující `cp-ceny-zahranici.data.ts`, takže **teď se nepřeloží**.
  - Doporučení: vzít ho jako základ, nebo z něj aspoň opsat řešení konfliktů. Typecheck ani testy po řešení konfliktů neběžely.
- **Zbývá ve stashi předělat:**
  - `international-shipping-price.ts` počítá s pevnou cenou za zemi → přepsat na výpočet v `calculatePrice` (oddíl 7.2);
  - admin sekce „Česká pošta do zahraničí“ v `admin/routes/doprava-platba/page.tsx` → nový obsah podle oddílu 9;
  - `smoke-order.mjs --shipping=international` posílá `prices_czk` → upravit na nové API.

## 9. Admin — Nastavení obchodu › Doprava a platba

Sekce „Česká pošta – na adresu zahraničí“:

- **Průměrná váha balíku do zahraničí** (kg, krok 0,1). Text: „Použije se, když některý výrobek v košíku nemá vyplněnou hmotnost.“
- **Obal** (kg), pokud se schválí (oddíl 6).
- **Služba ČP**: výběr z `cpServices()`, výchozí Standardní balík prioritní.
- **Tabulka zemí z regionů obchodu**, pro každou:
  - zaškrtnutí „posílat“ (GB ve výchozím stavu vypnuto);
  - cena z ČP pro průměrnou váhu, s použitou službou, když nastoupila náhradní;
  - nepovinná vlastní cena v Kč, která tabulku přepíše;
  - cena v EUR po převodu.
- **Řádek „Ceník ČP ze dne …“** (`fetched_at`) a připomínka, že se obnovuje skriptem.
- Volitelně **malá kalkulačka**: země + kg → cena všech služeb z engine, jako na postaonline.cz, aby si Lucie ověřila konkrétní balík.

Ukládá se přes `POST /admin/international-shipping` do dat volby a do `merchant-settings`. Patch je strict, takže nové klíče musí být v `KEY_SCHEMAS` a ve výchozích hodnotách. Upravit i `merchant-settings.unit.spec.ts`, který vyjmenovává klíče.

## 10. Postup

1. Engine a data (oddíl 5) + jednotkové testy.
2. Hmotnost košíku (oddíl 6) + testy: všechny s hmotností / některé bez / žádná / nad max.
3. Volba, zóna a `calculatePrice` (oddíl 7), převod ČNB, denní job.
4. Admin sekce (oddíl 9) a nastavení.
5. Pokladna a expresní pokladna (oddíl 7.4).
6. Ověření:
   - backend `npx tsc --noEmit` + jednotkové testy;
   - sandbox `smoke-order.mjs --country=de --shipping=international --provider=comgate`: výrobek s hmotností i bez ní;
   - storefront build do vlastní `NEXT_DIST_DIR` (ve storefrontu běží `next dev`);
   - v prohlížeči `npx valecms browser --headless` (ze `storefront/`): DE a SK, cena v EUR, žádná dobírka ani Balíkovna;
   - živě na produkci jedna objednávka do DE s ComGate v testovacím režimu, pak testovací objednávku uklidit.
7. Commit na větev → merge `--no-ff` do main → push (Railway nasadí obě služby). Hlídat `/api/version` na hash **merge commitu**.

## 11. Otevřená rozhodnutí (Matěj / Lucie)

1. **Služba ČP:** Standardní balík prioritní (podává se na poště bez smlouvy), nebo Obchodní balík (jen má-li ho Lucie ve smlouvě; na SK je výrazně levnější).
2. **Obal:** přičítat k sečtené hmotnosti (návrh 1 kg), nebo ne.
3. **Průměrná váha** do doby, než Lucie zváží balíky (návrh 3 kg).
4. **GB:** vynechat, dokud nebudou celní údaje (návrh ano).
5. **Částečně vyplněné hmotnosti:** podle zadání průměr pro celý balík. Alternativa: sečíst známé a za každý kus bez hmotnosti přičíst odhad. Přesnější, ale složitější na vysvětlení.
6. **Zaokrouhlení ceny v EUR** (např. na 0,10 €) a případná přirážka (`CNB_PRICE_MARKUP_PERCENT`).

## 12. Pasti

- **Hlavní checkout** `C:\Users\ADMIN\Documents\GitHub\Lucia_Polanska_eshop-keramickazahrada` používá jiná session. Pracovat ve vlastním worktree a do cizích rozdělaných souborů nesahat.
- **SCSS a části TS jsou s konci řádků CRLF.** Skripty s LF kotvami selžou potichu; při úpravách zachovat konce řádků.
- **Build storefrontu** jen do `NEXT_DIST_DIR=.next-…` a pak `git checkout -- storefront/tsconfig.json`.
- **Medusa slučuje metadata i data** voleb a dopravy. Klíč nesmažeš vynecháním.
- **`query.graph` a množství:** `items.quantity` bývá BigNumber, převádět ho na číslo s ohledem na to.
- **Podání na ČP je nevratné.** Zahraniční zásilku nikdy neposílat přes `parcelService`.
- **Nikdy negenerovat štítek ČP** na skutečné objednávce bez souhlasu Matěje.
