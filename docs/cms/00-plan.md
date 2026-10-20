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

**Lucie — texty, které na stránce vidět nejsou** (okna, stavy plateb, pokladna, účet, stránky
z e-mailu, 404, SEO): Studio → „Upravit kontent“ → přepínač „Stránky“ → „Modály“ nebo
„Seznamy“ → název (např. „Kontaktní okno“, „Platba — čekáme na banku“, „SEO — Kurzy“) →
formulář se všemi texty bloku → Uložit (koncept). Publikuje se v Obsahu: „Texty na webu“
(nebo Přehled → Naposledy upraveno) → blok → „Publikovat změny“ — tlačítko Publikovat
v „Upravit kontent“ bere jen bloky vidět na stránce. Texty otevřeného okna jdou upravit
i klikáním: Náhled → otevřít okno na stránce → Náhled vypnout → kliknout na text.

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
- [ ] E, druhé kolo (15. 10. večer, necommitnuto): kurzy (okno rezervace — nadpis
      z `kurzy.rezervace`, `kurzy.rezervace-okno`; stránka rezervace
      `kurzy.rezervace-stavy`), účet (nová stránka `ucet`: `ucet.formular`,
      `ucet.prehled`, `ucet.objednavky`), pokladna (nová stránka `pokladna`:
      `pokladna.uvod`, `pokladna.souhrn`, `pokladna.kroky` — jen úvodní věty),
      košík (`kosik.vypis`; napříč webem `global.kosik` — panel v menu, doprava
      zdarma, propojení košíku), obchod (`obchod.katalog`), hledání v menu
      (`global.hledani`), přibylo do `global.produkt` (nákup, volba, značky,
      pozvánka k recenzi), `global.kontaktni-okno` (popisky a vzory polí)
      a `global.newsletter` (věty po odeslání). Hluboké komponenty (menu,
      kroky pokladny) čtou blok kontextem `CopyProvider` / `useCopyBlock`.
      `seed-texts.mjs` u bloků s `mergeItems` doplní do vyplněných `items`
      chybějící popisky (na konec, stávající beze změny). Ověřeno: tsc, lint,
      textové snímky před/po s prázdným CMS a po seedu v soukromém úložišti.
- [ ] F dosažitelnost ve Studiu (15. 10. večer, necommitnuto): povrchy (`surfaces`
      ve `valecms.config.ts`) — Modály 4 (kontaktní okno, okno rezervace, košík v menu
      a doprava zdarma, hledání; okno se pod formulářem samo otevře přes
      `useStudioSurface` + `surfaceRoot`), Seznamy 29 (košík s výrobky, výzva
      k přihlášení, pokladna, výsledky plateb, poděkování, rychlý nákup, účet, stránka
      výrobku, katalog, newsletter, rezervace z e-mailu, 404, SEO). Bez `preview` — viz
      hlášení níž. `EditModeRemount` v layoutech (`(main)`, `(checkout)`, rychlý nákup):
      stránky s `loading.tsx` (obchod, košík, účet, výrobek, pokladna, stavy plateb)
      neměly ve Studiu jedinou anotaci obsahu (hydratační neshoda React 19). Opravené
      anotace: tlačítko newsletteru v patičce (`editableLink`, dřív by uložilo
      „OdebíratOdebírat↗“), podpis v hero (`editableDoc`, dřív by uložil „— Lucie Polanská“
      do `title`), obočí přihlášení bez „01 · “. Tlačítka v seznamu pod názvem a místem
      (dřív klíč), vydané právní znění zamčené celé (i dokument, platnost, poznámka)
      a „· uzamčeno“ v nadpisu editoru. Ověřeno maticí v prohlížeči (zrcadlo :8600,
      soukromé úložiště): stránky klik → uložit → publikovat → web; všech 33 povrchů
      najít → upravit → uložit → publikovat v Obsahu → web/publikovaná data; právní
      dokumenty (pracovní znění upravit + náhled + publikovat, vydané 423); soubory
      v patičce a u dokumentu; dotazy klikem na otázku.

## Co zůstalo v kódu záměrně

Souhlasy a předsmluvní informace v pokladně, poučení § 1837 u zakázky, řádky § 12a u cen,
text o ověřování recenzí, lišta cookies a soupis cookies (tabulky kapitoly „seznam“ se berou
vždy z `cookies-inventory.ts`), vysvětlení řazení „Doporučené“, formulář odstoupení,
chybové hlášky a stavy pokladny, poptávkový formulář zakázky. Z kurzů (od druhého kola)
souhlasy, storno podmínky, způsoby platby a ceny, věty o vracení peněz u rezervace, lhůta
48 hodin a pravidlo čekací listiny („Místo se přitom nedrží…“). Z účtu obnova hesla, ověření
e-mailu a mazání účtu (co se smaže a co zůstává kvůli účetnictví). Z pokladny věty u plateb
(záloha, Balíkovna, dobírka, kdy se platí) a slevové kódy. „(povinné)“ u polí formulářů.

## Pro autora ValeCMS (hlášení upstream)

> Stav 15. 10. večer: větev `feature/pravni-dokumenty` v repu valecms (a8c3c13, nevydaná)
> už řeší první skupinu — serverovou stráž (`guard`), 423/422 bez dialogu sloučení, zámek
> s lištou (`locked`), revize ze skriptů, `strict`/`readAll`, Duplikovat, `accentSlots`,
> typy, seed bez `DATABASE_URL` (`describeWriteTarget`). Otevřené zůstávají body od
> „Povrch s `preview`…“ níž (povrchy, Publikovat, hydratace `editable()`, titulky bloků).

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
- Povrch s `preview` pod App Routerem nefunguje: výběr povrchu volá `navigate(preview)`
  → `router.replace(?p=…)` → segment stránky Studia je klíčovaný parametry adresy →
  celé Studio se přemountuje, `tab` i `openSurface` spadnou na výchozí („Stránky“, nic).
  Návrh: v App Router adaptéru `shallow` přes `history.replaceState`, nebo záložku
  a povrch držet v adrese. Typy: `SurfaceOptions` nezná `preview`.
- „Publikovat“ v Upravit kontent sbírá jen `[data-cms-doc]` v rámu, takže blok uložený
  z povrchu nikdy nenabídne („Není co publikovat“), i když toast po uložení slibuje
  „objeví se až po publikování“. Návrh: přidat do sady dokumenty povrchů uložené v sezení,
  nebo „Uložit a publikovat“ přímo v popupu povrchu.
- `editable()` čte modulový příznak, který `useEditArming` zapne v efektu kořene; hranice
  Suspense hydratovaná později (každá stránka s `loading.tsx`) pak při HYDRATACI dostane
  atributy, které server nevykreslil → React 19 „attributes didn't match … won't be patched
  up“ → stránka bez anotací. Návrh: příznak přes `useSyncExternalStore` se server
  snapshotem `false`, nebo přemountování v knihovně. U nás obchází `EditModeRemount`.
- `siteCopy.preview`: titulkem je obsahový `title` (u mnoha bloků věta z webu — „Košík“
  dvakrát, SEO titulky jako „Časté otázky“), podtitulek je surové `page` a počet položek.
  Návrh: podtitulek `název stránky · key`. Web to přebít nemůže (typ z knihovny, registr
  odmítne druhou deklaraci).
- Editor dokumentu nemá lištu zámku (jen `readOnly` pole) — zámek u nás říká titulek.
- Rada na záložce povrchů mluví o formuláři i u povrchu s `preview`; hláška u stránky bez
  anotací („Obsah z CMS čte zatím jen úvodní stránka…“) je zastaralá (právní stránky).
