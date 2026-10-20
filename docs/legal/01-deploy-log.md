# Nasazení právního souladu — deploy log (2. kolo)

Zadání: LEGAL_AUDIT.md (2. kolo, 18. 10. 2026) + `00-plan.md` §6. Časy jsou v pražském čase
(SELČ), v závorce UTC. Hodnoty tajemství se do logu nezapisují, jen názvy proměnných.

## Výchozí stav (zjištěno 19. 10. 2026 21:41, 19:41 UTC — nic změněno)

### Repo

- `origin/main` = `2b7d417f` (14. 10.), `origin/legal/compliance-2026` = `b32a03b6` (16. 10.),
  merge-base = `2b7d417f` = `main` → sloučení bez konfliktu, 30 commitů navíc.
- Pracovní větev `legal/deploy-2026-10` založená z `b32a03b6`.
- `gh` (GitHub CLI) na stroji **není** nainstalované → PR přes `gh pr create` nejde založit
  (viz krok 1).

### Railway (projekt `disciplined-recreation`, prostředí production, EU West)

- Služby: Backend (online, https://dev.matejforejt.com), Storefront (online,
  https://store.matejforejt.com), PostgresNew (Postgres 17, svazek 0,3 GB / 4,9 GB), Redis.
  Odpojený svazek `bucket-volume` (3,9 GB, staré MinIO).
- Obě služby se nasazují **automaticky z větve `main`** (poslední nasazení 16. 10. 12:26 a 12:29,
  commit `2b7d417f`, kořeny `/backend` a `/storefront`). Sloučení do `main` = nasazení obou.
- Backend `start` je `medusa start` **bez migrací** → migrace se musí pustit ručně.
- Proměnné Backend (výběr podstatných): `SEGMENT_WRITE_KEY` **nastavená** (32 znaků);
  `BACKEND_PUBLIC_URL` ani `MEDUSA_BACKEND_URL` **chybí** (veřejná adresa je jen
  v `RAILWAY_PUBLIC_DOMAIN_VALUE` = https://dev.matejforejt.com, kterou odkaz na odhlášení
  nečte); `CMS_CRON_SECRET` **chybí**; `STOREFRONT_PUBLIC_URL` = https://store.matejforejt.com;
  `R2_PUBLIC_URL` = https://img.matejforejt.com; `COMGATE_TEST` = 1 (testovací platby);
  `MEDUSA_WORKER_MODE` = shared. Pozůstatky: `SANITY_*`, `PACKETA_API_KEY`, `MEILISEARCH_*`,
  `MINIO_*`.
- Proměnné Storefront: CMS proměnné **už jsou** (oproti 16. 10. přibyly) —
  `NEXT_PUBLIC_SUPABASE_URL` = https://uhxdqgxmyecgkximhzmt.supabase.co (projekt ve Frankfurtu),
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CMS_SESSION_SECRET`,
  `CMS_ADMIN_EMAIL`/`CMS_ADMIN_PASSWORD`, `CMS_MAIL_FROM` = noreply@dev.matejforejt.com,
  `CMS_MEDIA_BUCKET` = cms-media, `CMS_STORAGE_DRIVER` = supabase, `CMS_MEDIA_HOST`.
  **Chybí `CMS_CRON_SECRET`.** `NEXT_PUBLIC_GA_MEASUREMENT_ID` není (GA vypnuté).
  Pozůstatky starých textů: `CISLO_UCTU`, `IBAN`, `SWIFT_KOD`, `SIDLO_ADRESA`,
  `IDENTIFIKACNI_CISLO`, `INTERNETOVA_ADRESA` (nová větev je nečte — fakta jdou z administrace).

### Administrace (admin API, jen čtení)

- 267 produktů. Profil výroby (= zakázka se zálohou, povinné zadání, poučení o nevratnosti) má
  **1** produkt: „Keramická plastika - Pán lesa Dub - NA ZAKÁZKU“ (záloha 25 %).
- 27 produktů má v názvu „zakázk“, všechny zveřejněné, 26 bez profilu (seznam v kroku 3).
- „- SLEVA“: 3 zvonková tlačítka (Klasik Smetana 850 Kč, Retro Smetana 850 Kč, Paví mini
  750 Kč), kolekce Zvonková tlačítka, žádný ceník slev (v obchodě není ani jeden price list),
  žádná metadata slevy → „sleva“ je jen v názvu.
- Testovací kusy: „Keramická kytka bílá, modrý střed — poškozený“ (vada „TEST“) **zveřejněný**;
  „TEST Poškozený“ koncept; **navíc** produkt „TEST“ (`/products/test`, zveřejněný, popis
  „TEST“, balíček bez ceny, od 3. 10.) — audit ho nezmiňuje.
- Poukazy: „Dárkový poukaz na nákup keramiky“ za **1 Kč** zveřejněný; 5 poukazů s pevnou
  hodnotou 500–3000 Kč; `no_promo` nemá žádný.
- Pítka/nádoby/květináče: 47 produktů, 46 má v popisu upozornění na mráz; chybí u
  „Keramický květináč - Strom“.
- `GET /store/legal/facts` → 404 (nasazený `main` stránku Právní údaje ještě nemá; fakta
  v administraci tedy zatím nikdo nevyplnil).

### Fakta od zadavatele

Blok „Fakta od zadavatele“ v zadání je **celý nevyplněný** (`[[DOPLNIT]]` u všech položek).
Důsledky: OP, Odstoupení a Zásady se nevydají; Právní údaje zůstanou prázdné; profil výroby,
Domovní znamení a „- SLEVA“ se podle Faktů nastavit nedají (krok 3 jen vypíše seznam).
Datum účinnosti zůstává pracovní `2026-10-15`.

## Krok 0 — Segment vypnut

- 21:42 (19:42 UTC) `railway variable delete SEGMENT_WRITE_KEY --service Backend` →
  `{"deleted":true}`; kontrola výpisu proměnných: klíč už není.
- Smazání proměnné nové nasazení nespustilo → 21:43 `railway redeploy --service Backend`,
  nasazení `a6a8cb77` (commit `2b7d417f`) **SUCCESS**. Od této chvíle backend do Segmentu nic
  neposílá (bez klíče se klient Segmentu nevytvoří).
- Data, která už v Segmentu jsou (e-mail a jméno zákazníků z objednávek do 19. 10.), je potřeba
  smazat v účtu Segment (Twilio) — přístup k účtu nemám, **zbývá na Matějovi**.

## Proměnné nastavené před sloučením (bez okamžitého nasazení, `--skip-deploys`)

- Backend `BACKEND_PUBLIC_URL` = https://dev.matejforejt.com (veřejná doména backendu podle
  Railway; bez ní e-maily nevykreslí odkaz na odhlášení).
- `CMS_CRON_SECRET` vygenerovaný (32 bajtů, base64url) a nastavený **shodně** na Backend
  i Storefront (otisk SHA-256 prvních 8 znaků `07f26730` na obou). `storefront/.env.local` ho
  neměl; plán ho výslovně dovoluje generovat.

## Záloha produkční DB (před sloučením — migrace běží při startu backendu)

- 21:44 `railway ssh --service PostgresNew -- pg_dump --no-owner | gzip` → soubor
  `prod-2026-10-19.sql.gz` ve scratchpadu Clauda na stroji Matěje (mimo repo — obsahuje osobní
  údaje): 2,9 MB gzip / 9,2 MB SQL, `gzip -t` OK, 172 tabulek (`CREATE TABLE`), 172 bloků dat,
  patička „PostgreSQL database dump complete“, `product` 273 řádků, `order` 33 řádků.
  SHA-256 začíná `47ad26ff80fc6a76`. Doporučení: zkopírovat na trvalé místo (není to
  Railway snapshot; Hobby plán zálohy svazku nenabízí v rozhraní).

## Krok 1 — kontroly před sloučením (19. 10., větev `b32a03b6`)

| Část | Příkaz | Výsledek |
| --- | --- | --- |
| backend | `pnpm install --frozen-lockfile` | OK |
| backend | `pnpm typecheck` | OK (0 chyb) |
| backend | `pnpm test:unit` | 112 sad, 1508 testů, vše prošlo |
| backend | `pnpm build` | OK (backend 23 s, admin 40 s) |
| storefront | `pnpm install --frozen-lockfile` | OK |
| storefront | `tsc --noEmit` (skript `typecheck` v package.json není) | OK |
| storefront | `pnpm lint` | OK, 2 stará varování `@next/next/no-img-element` |
| storefront | testy skriptů `scripts/*.test.mjs` | 32/32 |
| storefront | `src/modules/analytics/consent-mode.test.mjs` | 12/12 |
| storefront | `NEXT_DIST_DIR=.next-check pnpm build:next` | OK |

Produkce před nasazením (`legal-prod.mjs`, 21:50): OP bez textu tlačítka (prázdné „“),
PlatímPak na Doprava a platba, `/reklamacni-rad` a `/smluvni-podminky/2015-01-01` → 404.
| sandbox | `node run-all.mjs start --fresh --storefront` (čistá DB, všechny migrace) | OK |
| sandbox | `node e2e.mjs` | **9/9 OK** (cookies, běžný výrobek, zakázka se zálohou, poukaz s vlastní částkou, kurz, dobírka, Koupit ihned, online odstoupení § 1830a, reklamace) |

Poznámka v reportu sandboxu „NÁLEZ: potvrzení objednávky zakázky neuvádí zálohu ani doplatek“
je **přenesená ze staršího běhu** (`_notes` v `e2e-results.json`, časy z 15./16. 10.). Opraveno už
commitem `84744aae` (16. 10.): `resolveBalanceStep` bere doplatek z kolekce pokladny, dokud
produkční objednávka nevznikne; přesně tento souběh pokrývá `order-balance.unit.spec.ts`
(6 testů, prošly). 19. 10. jsem ho zprvu mylně uvedl jako otevřený.

## Krok 1 — PR a sloučení

- 22:00 PR **#15** `legal/compliance-2026` → `main` založen přes GitHub API (`gh` není):
  https://github.com/C3Studium/Lucia_Polanska_eshop-keramickazahrada/pull/15
- Sloučení (merge commit, bez squashe) **zablokoval bezpečnostní klasifikátor Claude Code**
  („Merge Without Review“) — sloučení do `main` tady znamená okamžité nasazení do produkce.
  Neobcházeno. **Čeká na Matěje:** sloučit PR #15 tlačítkem „Create a merge commit“ (ne squash),
  nebo Claudovi povolit sloučení. Tím se spustí nasazení backendu (s migracemi) i storefrontu.

**Sloučeno 20. 10. 2026 ráno** — Matěj sloučil PR #15 tlačítkem na GitHubu (merge commit
`b8133456`, 30 commitů zachovaných).

## Krok 2 — nasazení (20. 10. 2026)

Časy v UTC (+2 h = Praha).

- 06:22 Railway spustil nasazení Backendu i Storefrontu z `b8133456`; 06:26 obě **SUCCESS**.
- Migrace (log backendu, `db:migrate --all-or-nothing` při startu): 06:25:56 „Migrations
  completed“ — `Migration20261014120000` (kurzy), `…14200000` (reklamace), `…14153217`
  (historie cen), `…14153743` (recenze), `…15120000` (email-optout) + starší
  `Migration20250801UpdateReviewStatusEnum` modulu recenzí, která na produkci dosud chyběla.
  06:26:05 „Server is ready“.
- Kontrola v DB (`psql` v kontejneru PostgresNew, jen čtení): `price_history_entry` ano,
  `email_opt_out` ano, `review.verified_purchase` ano; jediná recenze na produkci označena
  jako ověřený nákup (1/1, migrace ji ověřila podle objednávek).
- Skripty v kontejneru Backend (`railway ssh`, `npx medusa exec`):
  - `settle-service-lines.ts` nasucho: „#39: k zapsání 1 řádek vyskladněný, 1 odeslaný“.
    **Past:** `medusa exec` odmítá volbu `--apply` („Unknown argument: apply“) a ani
    `-- --apply` se skriptu nepředá — skripty přes CLI ostře spustit nešlo. Ostrý běh přes
    jednorázový obal `/tmp/settle-apply.js` (zavolá zkompilovaný skript s `--apply`, po běhu
    smazán): 06:27:53 „#39: zapsáno — vyskladněno 1, odesláno 1. Hotovo: 1 z 1“.
    Skripty opravené (commit na této větvi): berou i `apply` / `id=…` bez pomlček.
  - `backfill-price-history.ts`: 06:27:14 „pozorováno 792 cen, 792 nových záznamů, 0 snížených“.
  - `legal-voucher-product.ts` nasucho: 1 kandidát „Dárkový poukaz na nákup keramiky“
    (`prod_01M088T787RQR8MWN2M0W3HK5H`), nastaví `voucher_custom_amount=true`, 100–10 000 Kč
    po 100 (výchozí hodnoty kódu; Lucie je potvrzuje v e-mailu, bod 10). Ostře přes obal
    s `--apply --id=…`: 06:28:15 „metadata poukazu nastavena“.
  - Popis poukazu (admin API): nahrazen odstavec „…převeďte na předepsaný účet, poštovné pro
    ČR 60,-…“ větou „Částku poukazu zadáte přímo tady u výrobku, od 100 do 10 000 Kč. Zaplatíte
    ji v pokladně stejně jako jakýkoli jiný nákup.“; `lucie.polanska@gmail.com` →
    `info@keramickazahrada.cz`; telefon doplněn o „+“. Zbytek textu (platnost 1 rok, zaslání
    poštou/e-mailem) je Luciin a zůstal. Původní text uložen ve scratchpadu.
- Proměnné: `BACKEND_PUBLIC_URL` a `CMS_CRON_SECRET` (nastavené 19. 10.) platí od tohoto
  nasazení. CMS proměnné Storefrontu byly už před tím. GA se nenastavuje (Fakta: nevyplněno).
- Log skriptu potvrzuje vypnutý Segment: „[segment] SEGMENT_WRITE_KEY is not set — analytics
  events will be dropped.“
- Právní stránky v produkci (`legal-prod.mjs`, 06:29): OP s „Objednávka zavazující k platbě“,
  § 1832, ČOI, bez ODR, bez PlatímPak, bez prázdného tlačítka; `/smluvni-podminky/2015-01-01`
  200 + noindex; `/reklamacni-rad` 200; `[[DOPLNIT` jen u chybějících faktů (OP 11×,
  Zásady 5×, Odstoupení 1×, Doprava 1×).
- **Nalezeno a opraveno:** Zásady obsahovaly zástupný text `[[DOPLNIT: Twilio Segment …]]`
  (čekal na rozhodnutí vypnout/uvést). Segment je vypnutý → blok z pracovního znění Zásad
  odstraněn (repo) a přenesen do Studia (`seed-legal --refresh`); v produkci ověřeno, že text
  zmizel. Kdyby se Segment někdy znovu zapnul, musí se nejdřív doplnit do Zásad.

### Studio

- 06:31 `seed-legal --refresh` nasucho: 4 k přepsání (cookies, doprava, OP, zásady — ve Studiu
  neupravené), 4 beze změny (3 vydané 🔒 + odstoupení shodné). Pak `--write
  --i-know-this-is-production`: 4 přepsáno. Ve Studiu je všech 8 znění.
- `seed-texts` nasucho: 37 nových, 2 doplněné, 3 beze změny, 0 konceptů. `--write`: totéž.
  Kontrolní suchý běh: 0 nových, 0 doplněných, 42 beze změny.
- FAQ (#22) ve Studiu přepsané zněním, které už web ukazuje z kódu (`lib/legal/faq.ts`), a
  publikované:
  - „Jak postupovat, když zásilka dorazí poškozená?“ — bylo „…ozvěte se nám do 48 hodin…“;
  - „Mohu produkt vrátit nebo vyměnit?“ — bylo „Nepoužitý výrobek…“.
- Texty o kurzech ve Studiu (bloky `kurzy.*`, dotazy o kurzech) prověřené: neuvádějí storno
  lhůty ani částky, jen „rezervaci zrušíte přímo z e-mailu“ — s OP v souladu, beze změny.

## Krok 3 — data produktů (20. 10. 2026, admin API)

Provedeno (nezávisí na Faktech):

| Změna | Produkt | Výsledek |
| --- | --- | --- |
| skryto (stav koncept) | Keramická kytka bílá, modrý střed — poškozený (vada „TEST“) | published → draft |
| skryto (stav koncept) | „TEST“ (`/products/test`, balíček bez ceny) | published → draft, stránka ukazuje „nenalezena“ |
| `no_promo` | 6× Dárkový poukaz na nákup keramiky (vlastní částka + 500/1000/1500/2000/3000) | `metadata.no_promo = true` ověřeno; metadata poukazu zůstala |
| upozornění na mráz | Keramické napajedlo s žabkou na kameni | doplněna věta (viz `karticka-mrazuvzdornost.md`) |
| upozornění na mráz | Keramické pítko pro ptáky a hmyz - List velký 44cm - VYPRODANÉ | doplněna věta |

**Zastaveno — chybí Fakta** (celý blok „Fakta od zadavatele“ je nevyplněný):

- profil výroby u 26 produktů „na zakázku“ (seznam v e-mailu Lucii) a výše zálohy;
- „Domovní znamení NA ZAKÁZKU“ (pevná cena / poptávka);
- 3 produkty „- SLEVA“ (akční cena / odstranit SLEVA / kus s vadou).

## Krok 5 — nezávislá kontrola produkce (20. 10. 2026)

Kontrolní agent bez přístupu k administraci a DB (jen veřejný web, store API, PDF, Playwright),
zpráva: `docs/legal/audit/kontrola-produkce-2026-10-20.md` (screenshoty a stažené stránky
zůstaly ve scratchpadu).

**Ověřeno v produkci:** OP 2026 (1 rok, § 1832, § 1833, § 1837 d)+j), ČOI bez ODR, doména),
reklamace (řád + protokol, přeprava řeší prodávající, 30 dní), cookie lišta (Odmítnout
rovnocenné, před volbou 0 požadavků na cizí domény, GA 0, „Nastavení cookies“ otevře dialog),
PlatímPak pryč, tlačítko „Objednávka zavazující k platbě“ v pokladně (souhlas nezaškrtnutý),
Zásady bez Segmentu, kus s vadou bez přeškrtnuté ceny, archiv OP 2015.

**Selhalo — vše čeká na údaje / rozhodnutí Lucie** (seznam v OPEN_QUESTIONS „Stav po
nasazení“): 26 produktů na zakázku bez profilu výroby; OP/Odstoupení/Zásady nevydané (404 na
PDF, v patičce 2 PDF) a 20× `[[DOPLNIT]]` na webu; zpětné datum 15. 10.; „kolekce Poškozené“
v reklamačním řádu (opraví se s novou verzí); 3× „- SLEVA“ bez akční ceny; doména PDF; balné
u ceny (advokát).

**Opravy zprávy kontroly (ověřeno mnou):**
- „Popis poukazu zůstal původní“ — neplatí: produkční stránka poukazu má nový text („Částku
  poukazu zadáte přímo tady u výrobku…“), gmail ani „převeďte“ tam nejsou. `calculated_amount: 1`
  je katalogová cena varianty, vlastní částku dosazuje košík — očekávané.
- Neověřeno zvenku a ověřeno mnou: Segment (log backendu „SEGMENT_WRITE_KEY is not set“),
  merge, migrace, backfill a seed (kroky 2–3 výše).
- Kontrola nechala nedokončený košík (kontrola@example.invalid, 1× kytka, bez objednávky) —
  připomínky košíku jsou vypnuté, nic se neodešle.

**Pozor (mimo audit):** zástupný text u čísla účtu ukazuje zákazníkům všechna tři kandidátní
čísla účtu. Do vyplnění `bank.account` v Právních údajích to tak zůstane — vyplnit přednostně.

## 20. 10. dopoledne — číslo účtu a balné u ceny

- 08:56 (06:56 UTC) Právní údaje → `bank.account` (admin API `POST /admin/merchant-settings`,
  stejné úložiště jako stránka Právní údaje): „2500675505/2010 (IBAN CZ92 2010 0000 0025 0067
  5505, BIC FIOBCZPP); platby v eurech na účet 2701281289/2010 (IBAN CZ55 2010 0000 0027 0128
  1289, BIC FIOBCZPP)“. Zdroj: bankovní účty v iDokladu Lucie (Matěj, snímek obrazovky).
  Do minuty na webu (OP i Doprava a platba ověřeno); zástupný text se třemi kandidáty zmizel.
- Balné u ceny výrobku (rozhodnutí Matěje, OPEN_QUESTIONS #17d): pod cenou „+ balné X,- za kus
  — Cena balení je u každého výrobku jiná a účtuje se zvlášť.“ (částka z
  `metadata.packaging_price`, stejné čtení jako backend), u výrobku s balením 0 Kč „Balné
  u tohoto výrobku neúčtujeme.“ Upraven text OP (cena a platba) a Doprava a platba (Balné).
  **Projeví se až nasazením** (PR #16 do `main`) a následným `seed-legal --refresh`.

## Krok 3b — zakázky podle LEGAL_AUDIT § 0 (20. 10. 2026, větev `legal/deploy-2026-10`, NENASAZENO)

Zadání § 0 (pravidla Z1–Z12) přišlo 20. 10. dopoledne. Hotovo v kódu a otestováno v sandboxu;
do produkce jde až sloučením PR #16 (obsahuje migraci `Migration20261020120000`).

- **Před migrací ověřeno na produkci** (psql, jen čtení): `production_order` 8 řádků,
  `deposit_percentage > 50` = 0, profily > 50 = 0, přebití u provedení > 50 = 0 → DB checky
  strop 50 % projdou.
- Změny: viz CHANGELOG „Zakázky podle § 0 auditu“ (migrace, smluvní záloha, Z3 e-mail,
  zrušení Z4–Z7, Z6 job, PDF Potvrzení zakázky, pokladna/produkt/košík/účet, OP čl. IX,
  FAQ, Výroba, zdroj Reklamačního řádu).
- Kontroly: backend `pnpm typecheck` OK, `pnpm test:unit` 117 sad / 1558 testů OK (nové:
  cancellationPlan, smluvní záloha + validace 50 %, start výroby bez e-mailu nepřejde,
  initialize ukládá smluvní zálohu a emituje event, PDF deterministické a bez `{{`);
  storefront `tsc` OK, `lint` bez nových varování, testy skriptů 42/42.
- **Sandbox** (čistá DB s novou migrací, `run-all.mjs start --fresh --storefront`): původních
  9 scénářů OK, nový scénář **`z` OK** (`node e2e.mjs z`, 114 s):
  - objednávka #9 (zakázka, záloha 25 %, osobní odběr): `production_order.deposit_percentage` 25,
    `deposit_amount` 600 Kč, zaplaceno 679 Kč (600 záloha + 79 balné); PDF Potvrzení zakázky
    vygenerované (91 758 B, `%PDF`, otisk uložený), odkaz v datech potvrzovacího e-mailu i v
    panelu objednávky, `confirmation_sent_at` zapsáno; zrušení v panelu jedním krokem →
    stage `cancelled`, `cancelled_by customer`, `before_production`, refund ComGate 679 Kč,
    objednávka `refunded`, e-mail „Zakázka zrušena“ + zvonek majitelce;
  - objednávka #10: admin `confirm_specification` → `start_production` → e-mail „Vaše zakázka
    je ve výrobě“ (datum a čas), `production_start_notified_at` + ID notifikace uložené; panel
    „Ve výrobě od 20. 10. 2026 10:30“, dvoukrokové zrušení s textem „Záloha 600,- se nevrací.
    Vrátíme vám 79,-.“ → `after_production`, refund ComGate 79 Kč, `partially_refunded`.
  - Pokladna: checkbox „…a že záloha se po zahájení výroby nevrací.“, řádek „Zakázka“
    v předsmluvních informacích (záloha 25 %: 679,- teď, doplatek 1 800,-, výroba do 42 dnů od
    zahájení, věta o zrušení). Snímky `backend/sandbox/.artifacts/e2e/z1-*.png`, `z2-*.png`.
- **Omezení sandboxu:** Resend přijímá přílohy jen z https URL; sandboxové úložiště dává
  `http://localhost:9100/static/…`, takže maketa přílohu nevidí (scénář ověřuje PDF přímo).
  V produkci (R2 `https://img.matejforejt.com/orders/<order_id>/potvrzeni-zakazky.pdf`) příloha
  s e-mailem odejde — ověřit testovací objednávkou po nasazení.
- **Po nasazení udělat:** testovací zakázka na produkci (příloha PDF v e-mailu, Z3 e-mail,
  zrušení); vyplnit `vat.status` v Právních údajích (bez něj PDF větu o DPH vynechá).
- Otevřené: pojistka pro případ, že `initialize-merchant-order` spadne před emitem eventu
  (zakázková objednávka by nedostala potvrzení) — navrženo jako job; fotky z telefonu jdou do
  PDF 1:1 (bez zmenšení); advokát A1–A3 (`ADVOKAT.md`).

## § 0b a § 0c Z-B (20. 10. 2026 odpoledne, větev `legal/deploy-2026-10`, NENASAZENO)

- Inventura (admin API, jen čtení): 31 zveřejněných produktů tvrdí „zdravotně nezávadné“
  glazury / materiály (pítka, podmisky, štrůdláky, talíře); „Hrnek s ptáčkem“ naopak správně
  říká „není vhodný pro styk s potravinami“. Kategorie na webu nemají popis (nevykresluje se).
  Kategorie **Bezdrátové zvonky** má 2 zveřejněné produkty (Bezdrátový zvonek BZ8-113, Montážní
  krabička KP 68) — audit čekal prázdnou. 73 zvonkových tlačítek bez údaje o napětí; 8 popisů
  odkazovalo na starý e-shop `keramickazahrada.cz/shop/bezdratovy-zvonek-bz8-113/`.
- **Provedeno na produkci (admin API):** u 8 tlačítek nahrazen mrtvý odkaz větou „(bezdrátový
  zvonek najdete v obchodě v kategorii Bezdrátové zvonky)“; původní popisy zálohované ve
  scratchpadu Clauda (`bell-links-backup.json`). Nic jiného se v produkci neměnilo.
- ARES (RŽP, IČO 03441482): fyzická osoba, živnost volná od 26. 9. 2014, živnostenský úřad kód
  330501 (= Městský úřad Písek) — do OP zatím jen „zapsaná v živnostenském rejstříku“ (čl. I už
  obsahuje), úřad po potvrzení.
- Kód (commity debe3968, 31e890dd): `/certifikaty`, `lib/certificates.ts` (prázdný seznam),
  FAQ „Nezávadnost a bezpečnost“, `safety-notice` u výrobku, skript `food-claims.ts`
  (list/strip/restore, test), OP čl. VI/VII/VIII (kus s vadou, balíčky, zboží na objednávku,
  hlídání dostupnosti). Storefront `tsc` OK, testy skriptů 42/42; backend `tsc` OK.
- Tvrzení o nezávadnosti zatím v popisech ponechána — čeká se na protokoly a seznam glazur od
  Lucie (odstranění jednou větou: `npx medusa exec ./src/scripts/food-claims.ts strip`).
