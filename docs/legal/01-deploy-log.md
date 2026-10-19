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

Nález ze sandboxu (není nový, sloučení neblokuje): potvrzovací e-mail objednávky **zakázky**
ukazuje celkovou cenu, ale ne zaplacenou zálohu a zbývající doplatek — souběh subscriberů na
`order.placed` (`resolveBalanceStep` hledá production_order dřív, než ho
`initialize-merchant-order` založí). Řešení viz krok 6 / CHANGELOG.

## Krok 1 — PR a sloučení

- 22:00 PR **#15** `legal/compliance-2026` → `main` založen přes GitHub API (`gh` není):
  https://github.com/C3Studium/Lucia_Polanska_eshop-keramickazahrada/pull/15
- Sloučení (merge commit, bez squashe) **zablokoval bezpečnostní klasifikátor Claude Code**
  („Merge Without Review“) — sloučení do `main` tady znamená okamžité nasazení do produkce.
  Neobcházeno. **Čeká na Matěje:** sloučit PR #15 tlačítkem „Create a merge commit“ (ne squash),
  nebo Claudovi povolit sloučení. Tím se spustí nasazení backendu (s migracemi) i storefrontu.
