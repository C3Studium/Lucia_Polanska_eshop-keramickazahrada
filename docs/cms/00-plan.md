# Obsah do Studia, údaje obchodu do administrace (15. 10. 2026)

Zadání (Matěj, 15. 10.): „co nejvíc věcí, co není z backendu, napojit na CMS
Studio — i PDF, možná i smlouvy; co je spjaté s obchodem (zakázky, objednávky,
kurzy …) všechno na backend." Navazuje na právní soulad (`docs/legal/00-plan.md`).

## Rozdělení

| Kde | Co | Proč |
| --- | --- | --- |
| **Studio (ValeCMS)** | Znění právních dokumentů (verze), další soubory ke stažení, redakční texty webu, které dnes leží v kódu, SEO titulky stránek | Je to text — Lucie ho píše a vidí v náhledu webu |
| **Administrace obchodu (Medusa)** | „Právní údaje" (fakty `{{…}}`: identita, účet, DPH, záloha, storno kurzů, poukazy, lhůty, odhad nákladů vrácení, …) | Patří k obchodu a čte je i backend (e-maily, rezervace kurzů); nesmí záviset na CMS |
| **Kód (repo)** | Uzamčená (vydaná) znění dokumentů jako otisk, PDF pipeline, souhlasy, předsmluvní informace v pokladně, poučení § 1837, § 12a, lišta cookies + soupis cookies, logika obchodu | Váže se k objednávkám / zákonu; nesmí se změnit pod rukama |

## Neměnnost vydaných znění (to nejdůležitější)

ValeCMS **neumí** zamknout publikovaný dokument (kdokoli přihlášený ho může
upravit, stáhnout i smazat; revize píše jen Studio). Proto:

1. **Vydané znění = verze s PDF zveřejněným v R2** (`pdf-manifest.json`,
   absolutní https URL). Taková verze se na webu vykresluje VŽDY z repa —
   z TS modulu nebo z otisku `documents/snapshots/*.json`, který zapíše
   `pnpm legal:build` — a s fakty z otisku v manifestu (`entry.facts`).
   Co je v CMS pod stejným klíčem, se ignoruje.
2. **Zámek ve Studiu:** naše catch-all routa `app/api/cms/[...route]` obalí
   `handleCmsRequest` a u typu `pravniDokument` odmítne:
   - jakoukoli změnu vydaného znění (423 „Znění je vydané — pro změnu založte nové");
   - smazání / stažení / archivaci znění, které už platilo (`platnost <= dnes`);
   - změnu `dokument`/`platnost` u znění, které už platilo;
   - duplicitní `dokument@platnost`;
   - první publikaci znění s `platnost < dnes` (nic neplatí zpětně).
3. **Pracovní znění** (bez zveřejněného PDF) se dá upravovat; k e-mailům se
   nepřikládá nic (jako dosud). Do spuštění musí být všechna platná znění vydaná.

## Smlouvy (kontrakty mezi částmi)

### A. Backend — Právní údaje
- `backend/src/lib/legal-facts.ts`: `LEGAL_FACT_KEYS` (19 klíčů = `storefront/src/lib/legal/facts.ts`),
  výchozí hodnoty = `FACTS` ze storefrontu (identita + `delivery.dispatchTime`, zbytek `null`),
  popisky/nápověda/skupiny/max. délky pro formulář, `resolveLegalFacts(settings)`.
- merchant setting `legal_facts`: objekt `{ [klíč]: string }`; chybějící klíč = výchozí hodnota,
  `""` = výslovně nevyplněno (`null`).
- `GET /store/legal/facts` → `{ facts: Record<klíč, string | null>, updated_at: string | null }`,
  `Cache-Control: public, max-age=60`. Žádná tajemství.
- Admin stránka „Právní údaje" (formulář po skupinách, nápověda pro Lucii, odkaz na Studio).
- Backend sám čte údaje odsud (patička e-mailů, text storna v potvrzení rezervace) se zálohou
  na `legal-manifest.json`.

### B. Storefront — fakty
- `getLegalFacts()` (`storefront/src/lib/data/legal-facts.ts`, server-only, cache 60 s, záloha z kódu).
- `renderInline(text, { facts })`, `tokenize(text, facts)`, `inlineToPlain(text, { facts })`,
  `fact(key, facts)` — bez `facts` záloha z kódu. Klientské komponenty dostávají `facts` v props.

### C. Storefront — právní dokumenty ve Studiu
- Typ `pravniDokument` („Právní dokumenty"): `dokument` (výběr slugu), `platnost` (datum = verze),
  `nazev`, `uvod`, `kapitoly[] { kotva, nadpis, bloky[] }`, bloky `odstavec | seznam | tabulka |
  ramecek | formular` (rámeček o úroveň mělčí), `pdf` (ano/ne), `archivni`, `poznamka` (interní).
  Text bloků = stávající značka (`**tučně**`, `[odkaz](/cesta)`, `{{údaj}}`, `[[DOPLNIT: …]]`).
- Čtení: `getLegalRegistry()` (server-only) = sloučení kód + CMS + manifest. Klíč `slug@verze`;
  vydaná → repo; jinak CMS (v náhledu koncept) přebíjí kód; verze jen v CMS se přidají.
  Neplatný dokument z CMS se přeskočí (log). CMS nedostupné → kód.
- Import: `storefront/scripts/seed-legal.mjs` (suchý běh výchozí, `--write` zapíše jen chybějící;
  `legacy_source: "pravni-dokument"`, `legacy_id: slug@verze`). Spouští Matěj — **nikdy agent
  proti produkčnímu CMS**.
- `/api/legal/versions` vrací sloučené verze + živé fakty; `legal:build` zapisuje otisky
  `documents/snapshots/` a `facts` do záznamů manifestu.

### D. Soubory ke stažení
- `soubor` (už existuje) se napojí: u právních stránek „Další soubory", v patičce
  (`stranka: "paticka"`), případně kurzy/výroba. Oficiální PDF dokumentů dál generuje pipeline.

### E. Redakční texty z kódu do Studia
Výchozí text zůstává v kódu, CMS ho přebíjí (`blok?.pole?.trim() || "výchozí"`); prázdné CMS =
web beze změny. Seed (`scripts/seed-texts.mjs`) doplní bloky jen tam, kde chybí — spouští Matěj.
Nepřesouvá se nic, co je vázané na zákon nebo na logiku obchodu (viz tabulka nahoře).

## Jak se s tím pracuje

**Lucie — údaje:** administrace obchodu → „Právní údaje“. Nahoře „Chybí N z 19“, u každého
pole věta, kam se údaj dosadí, a příklad. Uložení se na webu projeví do minuty, v e-mailech hned.

**Lucie — text dokumentu:** Studio → „Právní dokumenty“ → pracovní znění (nebo nový záznam
s pozdějším „Platí od“) → „Náhled webu“ ukáže koncept → Publikovat. Vydané znění je ve Studiu
jen ke čtení a zámek odmítne jeho změnu, smazání i stažení. Studio neumí „duplikovat dokument“
— nové znění velkého dokumentu zatím založí Matěj (nebo se přepíše ručně).

**Lucie — soubory:** Studio → „Soubory ke stažení“ → stránka (právní stránka nebo „Patička
webu“). Oficiální PDF dokumentů sem nepatří, ta vznikají ze znění.

**Matěj — vydání znění:** `pnpm legal:build` (storefront čte produkční CMS a backend) →
`pnpm legal:upload --dry-run` → `pnpm legal:upload` → commit manifestů + `documents/snapshots/`
→ nasazení. Od té chvíle je znění uzamčené (web ho bere z repa s fakty z `entry.facts`).

## Stav

- [x] A backend — Právní údaje (19 klíčů, ne 17) — `1f46b2b`
- [x] B fakty na webu (prop ze serveru; hluboké klientské komponenty pokladny a FAQ přes
      `LegalFactsProvider` v kořenovém layoutu)
- [x] C právní dokumenty ve Studiu + zámek + seed + legal:build (`facts` doplněny do manifestu,
      PDF beze změny bajtů)
- [x] D soubory ke stažení (právní stránky „Další soubory ke stažení“, patička)
- [x] E redakční texty (O mně, obchod, košík a výsledky platby, poděkování za objednávku,
      rychlý nákup, newsletter, kontaktní okno, 404, texty u produktu, SEO titulky);
      dvě FAQ odpovědi o zákonných právech zůstávají přišpendlené kódem (vždy)
- [x] ověření: nezávislá kontrola (1 blokující + 12 dalších nálezů, opraveno — `b13a88d`,
      `35a69d3`); backend tsc + 1499 unit testů; storefront tsc, lint, `next build`, 32 testů
      právních dokumentů a zámku; sandbox E2E 9/9 (cookies, objednávky, zakázka, poukaz,
      kurz, dobírka, rychlý nákup, odstoupení, reklamace); administrace „Právní údaje“ →
      `/store/legal/facts` → OP na webu do minuty; patička e-mailu s živými údaji;
      legal:build `--check` beze změny PDF (sha256 stejné)
- [x] dokumentace (`docs/legal/00-plan.md` §5–6, OPEN_QUESTIONS)

## Co zůstalo v kódu záměrně

Souhlasy a předsmluvní informace v pokladně, poučení § 1837 u zakázky, řádky § 12a u cen,
text o ověřování recenzí, lišta cookies a soupis cookies (tabulky kapitoly „seznam“ se berou
vždy z `cookies-inventory.ts`), vysvětlení řazení „Doporučené“, formulář odstoupení,
chybové hlášky a stavy pokladny, kurzy (rezervace) a poptávkový formulář zakázky.

## Pro autora ValeCMS (hlášení upstream)

- Žádný serverový zámek dokumentu ani háčky (beforeSave/beforePublish) — museli jsme obalit
  catch-all routu; `readOnly` je jen v UI.
- `CmsError` neunese status jako 423 a kód `conflict` je přetížený (otevírá dialog sloučení).
- Revize zapisuje jen HTTP obsluha; `importRow` / repozitář ze skriptu žádnou.
- Čtečky polykají chyby → „CMS neběží“ a „nic tu není“ nejde rozlišit.
- `perPage` tiše omezené na 100; `readEditable` umí jen rovnost ve filtrech.
- Chybí akce „Duplikovat dokument“.
- `siteCopy.accent` max. 6 položek; typy: `@c3studium/valecms/server` jako `Record<string, unknown>`,
  `toNodeRequest` nedeklarované, `FieldOptions.readOnly` typované jako boolean, i když bere funkci.
- Seed skripty v šabloně chtějí `DATABASE_URL`, i když se jede na Supabase API.
