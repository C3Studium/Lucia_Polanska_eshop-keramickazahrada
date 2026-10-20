# Sandbox — lokální izolované prostředí pro testovací objednávky

Plně lokální kopie obchodu: vestavěný Postgres, backend (Medusa) a storefront
(Next) proti němu, e-maily do souborů, ComGate jako lokální maketa. **Nic
nejde do produkce** — žádná ostrá databáze, R2, Resend, iDoklad, ComGate,
dopravci ani CMS.

| Služba | Adresa |
| --- | --- |
| Postgres (embedded-postgres 17) | `127.0.0.1:54329`, db `medusa_sandbox`, `postgres` / `sandbox` |
| Zachytávač e-mailů + maketa ComGate + PDF + kurzy ČNB | <http://127.0.0.1:54400/> |
| Backend | <http://localhost:9100> (`/health`; admin UI jen s `--admin` → `/app`) |
| Storefront | <http://localhost:8100/cz> |
| Admin API | `admin@sandbox.test` / `sandbox-admin-123` |

## Rychlý start

Bash (Git Bash):

```bash
cd backend/sandbox
npm install                     # jen poprvé — vlastní node_modules sandboxu
node run-all.mjs start          # DB + zachytávač + migrace + seed + backend
node storefront.mjs start       # storefront na :8100 (první překlad ~1–2 min)
node smoke-order.mjs            # testovací objednávka přes Store API
node run-all.mjs stop           # zastaví všechno (i storefront a Postgres)
```

PowerShell (stejné příkazy):

```powershell
Set-Location backend\sandbox
npm install
node run-all.mjs start --storefront
node smoke-order.mjs
node run-all.mjs stop
```

Další příkazy:

```bash
node run-all.mjs start --fresh        # smazat DB, e-maily, stav makety → načisto
node run-all.mjs restart [--no-seed]  # nový kód backendu: restart backendu + zachytávače (DB zůstává)
node run-all.mjs status
node backend.mjs check                # důkaz izolace: registrovaní poskytovatelé, citlivé proměnné (jen jména)
node backend.mjs migrate | seed | exec <soubor.ts>
node db.mjs status | sql "select …"   # dotaz do sandboxové DB
node storefront.mjs sync | stop | clean | fg
```

Testovací scénáře přes API:

```bash
node smoke-order.mjs                                   # běžný výrobek, osobní odběr, platba při vyzvednutí
node smoke-order.mjs --provider=comgate --shipping=cz_address
node smoke-order.mjs --product=made_to_order --provider=comgate   # zakázka, záloha kartou
node smoke-order.mjs --product=voucher_custom --voucher-amount=1500 --provider=comgate
node smoke-order.mjs --country=sk --shipping=sk_address --provider=comgate
node smoke-course.mjs [--payment=online] [--no-consent]          # rezervace kurzu se souhlasy
```

Testy přes skutečné UI storefrontu (Playwright z `storefront/node_modules`,
Chromium; sandbox musí běžet i se storefrontem):

```bash
node e2e.mjs                       # všechny: cookies a b c d e f withdrawal complaint
node e2e.mjs a withdrawal          # jen vybrané (withdrawal potřebuje výsledek „a“)
node e2e.mjs report                # znovu sestavit .artifacts/report.md
```

Scénáře: `cookies` (lišta, žádné google* před souhlasem), `a` běžný výrobek →
ComGate, `b` zakázka (zadání + poučení, záloha), `c` poukaz s vlastní částkou,
`d` rezervace kurzu (RezervaceModal, na místě), `e` dobírka, `f` „Koupit ihned“
(přihlášený zákazník s adresou), `withdrawal` online odstoupení od objednávky
z „a“ (odeslání + doručení přes admin API, odkaz z e-mailu), `complaint`
reklamace. Výstup: `.artifacts/e2e/*.png`, `.artifacts/e2e-results.json`,
`.artifacts/report.md`. Prohlížeč smí jen na localhost; ostatní požadavky se
blokují a vypisují.

Každý běh uloží `.artifacts/smoke-*.json` / `course-*.json`: `order.metadata`,
položky, platby, notifikace (šablona, příjemce, stav, `data.__attachments`)
spárované se zachycenými e-maily (předmět, přílohy s bajty a sha256).

Volby `smoke-order.mjs`: `--product=regular|made_to_order|voucher_custom|voucher_fixed`,
`--shipping=pickup|cz_address|cz_balikovna|cz_fragile|sk_address|sk_fragile`,
`--provider=pickup|system|comgate|dobirka`, `--country=cz|sk`, `--email=…`,
`--terms-version=…`.

## Co seed založí (`seed.ts`, idempotentní)

- obchod CZK (výchozí) + EUR, prodejní kanál, publishable key **Webshop**
  (storefront si ho bere přes `/key-exchange`), admin uživatel
- regiony **Česká republika** (CZK, `cz`) a **Slovensko** (EUR, `sk`); platby
  `pp_system_default` („Testovací platba“, vypnout `SANDBOX_SYSTEM_PAYMENT=0`),
  `pp_comgate_comgate` (→ maketa), `pp_osobni-odber_pickup`, `pp_dobirka_ceska-posta` (jen CZ)
- sklad „Ateliér Putim“, výchozí profil dopravy, doprava: osobní odběr (pickup,
  CZ+SK, 0), Česká pošta na adresu 150 Kč, Balíkovna 90 Kč, křehké 250 Kč,
  SK na adresu 12 €, SK křehké 18 € (`ceska-posta-fulfillment_balikovna` bez
  přístupů = jen záznam, bez volání ČP)
- kategorie `keramika`, `zakazkova-vyroba`, `darkove-poukazy` + kolekce
- produkty: (a) **Sandbox — Miska Zahrada** 890 Kč, 10 ks; (b) **Sandbox —
  Květináč na zakázku** 2 400 Kč s profilem výroby (záloha 25 %) a
  `metadata.made_to_order`; (c) **Sandbox — Dárkový poukaz (vlastní částka)**
  `voucher_custom_amount` 500–10 000 po 100, katalogová cena 1 Kč jako na
  produkci; (c2) poukaz 1 000 Kč s pevnou cenou
- (d) vypsaný termín kurzu za 3 týdny (8 míst, 1 200 Kč)
- nastavení obchodu: e-maily `owner@sandbox.test` / `dev@sandbox.test`, zkušební režim

Id a klíč jsou v `.run/seed-state.json`.

## Izolace — jak je zajištěná

1. **Ostré `.env` se nenačtou.** Každý proces sandboxu běží s
   `NODE_OPTIONS=--require lib/env-guard.cjs`. Pojistka dělá ze souborů `.env*`
   v `backend/`, `storefront/`, kořeni repa a kopii storefrontu „neexistující“
   soubory (ENOENT pro read/stat/open) — `loadEnv` Medusy i `@next/env` je
   přeskočí. Navíc `lib/env.mjs` nastaví **každou** proměnnou, jejíž jméno je
   v ostrých env souborech, explicitně (bezpečná hodnota nebo `""`), a dotenv
   existující proměnnou nepřepisuje. Z ostrých souborů se čtou jen jména;
   jedinou výjimkou jsou veřejné údaje o prodávající pro storefront (IČO, sídlo,
   účet — `STOREFRONT_PUBLIC_FACTS`).
2. **Odchozí síť jen na localhost.** Pojistka obaluje `fetch` i `http(s).request`:
   `payments.comgate.cz` → maketa, `www.cnb.cz` → pevné kurzy, `legal.sandbox.test`
   → PDF ze `storefront/public/legal`, Google Fonts (jen storefront, čtení);
   cokoli jiného se odmítne a zapíše do `.logs/egress-blocked.log`.
3. **Drátová past.** Když by v procesu kdykoli byla produkční hodnota
   (DATABASE_URL mimo :54329, R2/MinIO, iDoklad, Redis, Resend mimo localhost,
   ComGate bez prefixu `sandbox-` …), proces skončí kódem 97 a zapíše
   `.logs/guard-violations.log`. Bez `SANDBOX_GUARD=1` se proces se pojistkou
   vůbec nespustí.

Výsledek `node backend.mjs check`: soubory jen `@medusajs/file-local`, bez
Redis modulů, notifikace `local [feed]` + `resend [email]` (base URL zachytávač),
iDoklad modul neregistrovaný.

## Zachytávač e-mailů (`mail-catcher.mjs`)

Resend SDK čte `RESEND_BASE_URL` → `POST /emails` (i `/emails/batch`) končí tady.
Každá zpráva: `.mail/<čas>-<nn>-<předmět>.json` (komu, od, předmět, tagy,
přílohy — filename, `path`, stav stažení, bajty, sha256, PDF ano/ne) + `.html`
+ stažené přílohy v `.att/`. Přehled: <http://127.0.0.1:54400/>, JSON
`/api/list`, smazat `POST /_reset`. Notifikace v DB mají `external_id` = id ze
zachytávače (`lib/api.mjs#notificationsSince` je páruje).

### PDF příloha potvrzení objednávky

Produkce přikládá PDF z https adresy v R2 (`pnpm legal:upload`), sandbox do R2
nesmí. Proto `lib/legal-manifest.mjs` vyrobí `.run/legal-manifest.sandbox.json`
(kopie `backend/src/lib/legal/legal-manifest.json` s adresami
`https://legal.sandbox.test/legal/<soubor>`) a pojistka ji backendu podstrčí
místo originálu. Zachytávač PDF servíruje ze `storefront/public/legal`.
Pracovní PDF (`draft: true`, `[[DOPLNIT]]`) backend správně nepřiloží; jen pro
test mechanismu: `SANDBOX_LEGAL_ALLOW_DRAFT=1 node run-all.mjs restart`.

## Maketa ComGate (`lib/comgate-mock.mjs`)

Backend volá `https://payments.comgate.cz/v2.0/…` natvrdo — pojistka to
přesměruje na `http://127.0.0.1:54400/comgate/v2.0/…`. Platba vrací
`redirect = https://comgate.sandbox.test/pay/<transId>`; skutečná stránka je
`http://127.0.0.1:54400/comgate/pay/<transId>` (tlačítka Zaplatit / Zrušit /
Odejít, `data-testid="comgate-pay"` …). V Playwrightu přesměrovat host přes
`context.route("https://comgate.sandbox.test/**", …)`. Skriptem:
`POST /comgate/_simulate/<transId> {"status":"PAID"}` → oznámení do
`/hooks/payment/pp_comgate_comgate` + návratová URL. Stav: `/comgate/_list`.

## Storefront (`storefront.mjs`)

Běží z **kopie** v `%LOCALAPPDATA%\keramickazahrada-sandbox\storefront`
(zrcadlí `src`, `public`, `scripts`, `content`, `.cms-dev` a konfiguraci;
`node_modules` je junction na `storefront/node_modules`, `.env*` se nekopírují).
Důvody: `storefront/.next` používá vývojový server na :8000, jiný distDir by
Next zapsal do sledovaného `storefront/tsconfig.json`, souborové úložiště CMS
by psalo do sledovaného `.cms-dev/store.json`. `start` kopii vždy znovu
zrcadlí (robocopy /MIR), takže běží aktuální kód. CMS je vypnuté (prázdné
Supabase proměnné → souborové úložiště v kopii → texty z kódu).

## Soubory

```
db.mjs               Postgres (init/start/stop/reset/sql)
mail-catcher.mjs     Resend API + přehled + /comgate + /cnb + /legal
backend.mjs          migrate / seed / start / watch / exec / check
seed.ts              seed (medusa exec)
check-isolation.ts   výpis registrovaných poskytovatelů (medusa exec)
storefront.mjs       kopie storefrontu + next dev :8100
run-all.mjs          start / restart / stop / status
smoke-order.mjs      testovací objednávka přes Store API
smoke-course.mjs     testovací rezervace kurzu
lib/                 config, env, env-guard.cjs, proc, api, comgate-mock, legal-manifest
.pgdata .mail .logs .run .artifacts   (gitignored)
```
