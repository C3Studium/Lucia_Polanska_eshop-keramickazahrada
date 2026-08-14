# FINISHING TODO LIST — vše, co musí být hotové před produkcí

Jediný závazný seznam před spuštěním. Co je hotové, škrtej. Kódové změny řeší
sprint prompty v `docs/sprint-2026-08-14/`; tady je to, co zbývá po nich.

## 1. iDoklad — kompletní implementace (POSLEDNÍ velká změna před launchem)

Kód je HOTOVÝ (2026-08-14: modul `backend/src/modules/idoklad`, subscriber,
admin routes + widget, e-mail šablona; tsc + 334 unit testů + build zelené).
Zbývá: env vars z bodu 2 do Railway a ověření naživo s reálnými klíči
(Default bez `templateId`, názvy způsobů úhrady „Dobírkou"/„Platební kartou",
filtr kontaktů podle e-mailu). Checkboxy škrtej až po ověření:
- [ ] OAuth2 klient (client credentials, api.idoklad.cz v3), vystavení faktury
      po zaplacení objednávky (dobírka → při předání dopravci)
- [ ] Režim **neplátce DPH** (Lucia není plátce — žádné DPH na dokladech)
- [ ] PDF faktury zákazníkovi e-mailem + uložení do MinIO
- [ ] Admin: widget na detailu objednávky (číslo faktury, stáhnout PDF,
      vystavit znovu, důvod chyby)
- [ ] Idempotence přes `order.metadata.idoklad_*` — nikdy dvakrát
- [ ] Ostrá číselná řada až při přepnutí na produkci
- Stavební plán: `docs/sprint-2026-08-14/model-1-backend-integrations.md` §C

## 2. Přístupy dopravců → Railway env vars

- [ ] **Balíkovna nAPI** (dorazí ~16. 8.): vložit do Railway (backend service)
      `BALIKOVNA_API_URL`, `BALIKOVNA_API_TOKEN`, `BALIKOVNA_API_SECRET`,
      `BALIKOVNA_CUSTOMER_ID` — pak ověřit řetěz objednávka → podání → štítek
- [ ] **iDoklad env vars** (Railway, backend service; dokumentace:
      `docs/env-inventory.md` + `backend/.env.template`):
      - [ ] `IDOKLAD_CLIENT_ID` + `IDOKLAD_CLIENT_SECRET` — generuje Lucia
            v iDokladu: Nastavení → Aplikace → záložka API → „Vygenerovat".
            **Tohle stačí** — ověřeno NAŽIVO 2026-08-14: token OK, agenda
            „Lucie Polanská" (IČO 03441482), neplátce DPH ✓. Klíče jsou
            zakomentované v `backend/.env` (jsou od OSTRÉ agendy — pozor na
            lokální testy); zbývá vložit do Railway
      - volitelné (pojistka do budoucna): `IDOKLAD_APPLICATION_ID` —
        registrace aplikace na https://developer.idoklad.cz; nový v3 token
        endpoint ho vyžaduje a jednou může legacy cestu nahradit. Neblokuje
        launch
      - [ ] `IDOKLAD_TEST_MODE=true` — jen dokud jsou v ID/SECRET klíče ze
            zkušebního účtu (iDoklad nemá sandbox → testuje se přes druhý
            účet, 60 dnů trial zdarma); widget pak ukazuje badge „Test"
      - volitelné: `IDOKLAD_VAT_PAYER` (nechat prázdné — neplátce DPH),
        `IDOKLAD_NUMERIC_SEQUENCE_ID` (ostrá číselná řada, až bod 5)
      - bez `IDOKLAD_CLIENT_ID/SECRET` se modul vůbec neregistruje — e-shop
        běží normálně, faktury se jen logují jako přeskočené
- [x] **Tarif iDokladu**: ověřeno přes API 2026-08-14 — Lucia MÁ Oblíbený
      (roční, 4 300 Kč bez DPH), tj. 7 500 API požadavků/měs (obnovuje se
      každý měsíc v ceně). Zdarma/Základní API nemají → padaly by na 402.
- [ ] **‼️ Předplatné iDokladu končí 18. 8. 2026** (za pár dní!) — poslední
      záznam v agendě běží 18. 8. 2025 → 18. 8. 2026. Ověřit s Lucií, že se
      obnoví — bez něj API přestane fungovat přesně v období launche.

## 3. Data a obsah

- [ ] **Číslo účtu** — potvrdit, které je pravé (obchodní podmínky:
      2500675505/2010 + EUR 2701281289/2010 vs merchant.ts: 7010757121/2010)
      a sjednotit v `storefront/src/lib/data/merchant.ts` (jediný zdroj pravdy)
- [ ] Reklamační protokol PDF od Lucie → `storefront/public/dokumenty/`
- [ ] Oficiální loga Balíkovny z implementačního balíčku ČP →
      `storefront/public/assets/img/` (nahradit aproximovanou `balikovna.svg`)
- [ ] Právní texty po přepisu zkontrolovat Lucia / právník
- [ ] E-mail copy pass — projít náhledy Resend šablon očima zákazníka

## 4. Rozhodnutí klienta

- [ ] **Packeta / Zásilkovna**: provider zůstává v kódu (opravený), ale
      NENABÍZÍ se — žádná shipping option, dokud klientka nerozhodne

## 5. Přepnutí na ostro

- [ ] `COMGATE_TEST` vypnout (do té doby jsou všechny platby testovací)
- [ ] iDoklad na ostro: vyměnit `IDOKLAD_CLIENT_ID/SECRET` ze zkušební agendy
      za Luciiny (iDoklad nemá sandbox — testuje se přes druhý účet zdarma),
      smazat/vypnout `IDOKLAD_TEST_MODE`, případně nastavit
      `IDOKLAD_NUMERIC_SEQUENCE_ID` na ostrou číselnou řadu
- [ ] DNS → produkční doména, SSL, redirect ze staging URL,
      `NEXT_PUBLIC_SITE_ENV=production` (staging zůstává noindex)
- [ ] Vyčistit testovací data z DB (objednávky, zákazníci)
- [ ] Zálohy DB nastavené + vyzkoušená obnova
- [ ] Analytika (pokud bude) až za cookie souhlasem — dnes žádná není a lišta
      to říká pravdivě

## 6. Testování (po dokončení kódu)

- [ ] Testovací scénáře z README §3 — všechny, s testovacími daty
- [ ] Probudit Railway test DB → integrační suite (75+) znovu zelená
- [ ] Playwright E2E napojit až na finální UI
- [ ] Admin workflow s Lucií: sama projde svůj denní postup
