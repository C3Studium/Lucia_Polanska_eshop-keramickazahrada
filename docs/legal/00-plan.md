# Právní soulad e-shopu — plán práce

Zadání: `LEGAL_AUDIT.md` (kořen repa, 14. 10. 2026). Větev `legal/compliance-2026`.
Tento soubor je výsledek průzkumu repa a rozdělení práce. Stav se průběžně doplňuje
v sekci „Stav“ na konci.

---

## 1. Co jsme v repu našli (průzkum 14. 10. 2026)

### Právní stránky a obsah
- Šest právních stránek (`storefront/src/app/[countryCode]/(main)/{smluvni-podminky,odstoupeni-od-smlouvy,reklamacni-protokol,doprava-a-platba,ochrana-osobnich-udaju,cookies}`) sdílí komponentu `modules/legal/LegalDocument`.
- Text je **v kódu** (`sections` v TSX / `smluvni-podminky/data.ts` + `supplements`), ale **CMS (ValeCMS, blok `<slug>.text`) ho za běhu přepisuje odstavec po odstavci podle pořadí kapitol**. Pole CMS má strop 1000 znaků na kapitolu → dlouhé kapitoly OP se do CMS ani nevejdou. Produkční obsah CMS není v repu.
- ⇒ **Rozhodnutí:** právní dokumenty se přesouvají do verzovaného registru v repu (`storefront/src/lib/legal/`), CMS je u nich vypnuté. Důvody: verze OP se váže k objednávce, z textu se generuje PDF, advokát čte změny v PR, CMS by nové znění přepsalo starým. (Hero texty stránek zůstávají editovatelné? Ne — datum účinnosti a název musí sedět s verzí; CMS se u právních stránek vypíná celé.)
- Kurzy, Výroba, Dotazy: texty z CMS s fallbackem v kódu. FAQ z CMS (qna) — fallback v kódu se ukáže jen při prázdném CMS ⇒ právní FAQ (zakázka, kurzy, poukazy) se vykreslí jako **pevná sekce z kódu** pod otázkami z CMS.
- Výchozí čísla účtu: OP `2500675505/2010`, `2701281289/2010`; `lib/data/merchant.ts` `7010757121/2010` (Doprava). PlatímPak na stránce Doprava (ale ComGate selector ho výslovně nenabízí). `PLATCE_DPH = false` v `lib/util/dph.ts` (komentář: „plátcem DPH není“) — rozpor s OP čl. IV („je plátcem DPH“).
- Reklamační protokol: stránka „Formulář ještě dokončujeme“; backend už umí PDF protokolu ke konkrétní žádosti (`backend/src/lib/reklamacni-protokol.ts`, pdf-lib + font Sansation s češtinou).

### Checkout a objednávka
- Kroky: adresa → doprava → platba → přehled (`modules/checkout/**`). Express checkout (jeden výrobek) nemá krok přehledu.
- Finální tlačítka: „Zaplatit {částka}“ (ComGate), „Potvrdit — zaplatíte při převzetí/vyzvednutí“, „Potvrdit objednávku“ (testovací), express „Potvrdit objednávku a zaplatit“. Krok Platba má tlačítko „Potvrdit objednávku a zaplatit“, které jen přepne na přehled (klamavé). **Nikde „Objednávka zavazující k platbě“.**
- Souhlas s OP: checkbox (nezaškrtnutý) → `cart.metadata.terms_accepted_at` (čas z prohlížeče) + `terms_version = "2026-08"` → zkopíruje se do `order.metadata`. Backend ho nekontroluje, admin ho nezobrazuje.
- Přehled před odesláním: chybí způsob platby (u ComGate), dodací/výrobní lhůta, poučení o odstoupení / výjimce, kontakt na prodávající; u zakázky „Celkem“ ≠ účtovaná záloha.
- Předzaškrtnutá políčka: žádná souhlasová (fakturační = dodací adresa je funkční přepínač, ne souhlas).
- Zakázka: detekce `product.metadata.made_to_order` (profil výroby) nebo kategorie `zakazkova-vyroba`; zadání (text/fotky) povinné před platbou; **žádné poučení o vyloučení odstoupení** před smlouvou; záloha jen kartou.
- Kurzy: samostatná rezervace (`modules/kurzy/RezervaceModal`, backend modul `course`), mimo košík. Žádné OP, žádné poučení § 1837 písm. j), žádné storno podmínky před rezervací. Systém dnes: zrušení zákazníkem do 48 h před kurzem s automatickým vrácením 100 %, nezaplacené online rezervace propadnou po 24 h.
- Poukazy: **žádná implementace** (ani gift card, ani kredit) — jsou to běžné produkty z WooCommerce, „1 Kč“ poukaz existuje jen v produkční DB.
- Dobírka: existuje — jen CZ, jen Česká pošta na adresu (ne Balíkovna), ne u zakázky; poplatek z nastavení obchodu.
- Košík ukazuje „Doprava 0 Kč/0 €“, dokud není zvolená doprava (i u SK/EUR).

### Odstoupení, reklamace
- Modul `return-request` + `lib/claims/*`: žádost reklamace / vrácení / odstoupení přes podepsaný odkaz (token) i v účtu; formulář `RefundRequest` odešle jedním kliknutím („Odeslat žádost“), bez potvrzovacího kroku.
- Lhůta 14 dnů se počítá od `shipped_at` (ne od převzetí). Zakázka vyloučena jen když je zakázka **celá** objednávka; smíšená objednávka zakázkové položky nevylučuje.
- E-mail potvrzení přijetí existuje (`refund-request`), chybí datum a čas uplatnění/odeslání.

### E-maily, soubory, nasazení
- Resend provider (`backend/src/modules/resend/service.ts`) **neumí přílohy**; Resend SDK i Medusa je podporují. Notifikace ukládá jen `data` → přílohy jako `data.__attachments` (URL), aby přežily opakované odeslání.
- Soubory: Cloudflare R2 přes vlastní provider `minio-file` (klíč vždy s náhodnou příponou) → pro trvalé URL PDF přímý S3 `putObject` s pevným klíčem.
- Nasazení: Railway (backend bez railway.json, storefront `railway.json`), migrace jsou ručně psané (generátor nedosáhne na DB).
- Lokálně: DB jen na Railway (interní adresa), žádný Postgres/Docker, lokální `.env` míří na ostré R2 a Resend ⇒ testy proti lokální DB vyžadují samostatné „sandbox“ prostředí (workstream H).
- Cookies: vlastní lišta (`modules/layout/CookieNotice`, výchozí odmítnuto). **Žádné Google Analytics se nenačítají** (stránka Cookies tvrdí opak). Google Maps iframe (kontakt) se načítá bez souhlasu. „Nastavení cookies“ v patičce na /checkout nefunguje (lišta tam není připojená).
- Recenze: vyžadují přihlášení, **neověřují nákup, a přesto se u všech zobrazuje „ověřený nákup“** (klamavé).
- Řazení „Doporučené“ = výchozí pořadí Medusy, nic kurátorského.
- Historie cen: neexistuje (`price-watch` drží jen poslední cenu sledovaných variant).

---

## 2. Sdílené jádro (hotové před spuštěním workstreamů)

`storefront/src/lib/legal/`
- `types.ts` — tvar dokumentu (`LegalDocumentVersion`, bloky p/ul/ol/table/box/form, vnořená značka).
- `facts.ts` — údaje o prodávající; chybějící = `null` → `[[DOPLNIT: …]]`.
- `inline.tsx` — vykreslení značky (web, tisk, prostý text).
- `registry.ts` — verze dokumentů, platná/připravovaná verze, `currentTermsVersion()`, PDF z manifestu.
- `documents/index.ts` — seznam všech verzí (plní A).
- `pdf-manifest.json` — vygenerovaná PDF (plní C).
- `cookies-inventory.ts` — skutečný soupis cookies (udržuje E, vykresluje A).
- `docs/legal/sources/nv-29-2023-priloha.md` — doslovný přepis vzorového poučení a formuláře z NV 29/2023 Sb. ve znění NV 66/2026 Sb.

Datum účinnosti nových dokumentů: **2026-10-15** (konstanta = verze v názvu souboru). Při spuštění na ostré doméně se nastaví skutečné datum (nový soubor verze / přejmenování) a znovu se spustí `pnpm legal:build` — viz OPEN_QUESTIONS.

---

## 3. Workstreamy (každý = jeden subagent, soubory se nepřekrývají)

| WS | Obsah | Soubory, které smí měnit |
| --- | --- | --- |
| **A — Texty** | Nové OP (+ archiv 2015 na `/smluvni-podminky/2015-01-01`), Reklamační řád (nová stránka `/reklamacni-rad`), Reklamační protokol (návod + formulář), Odstoupení (doslovné poučení + formulář + online cesta), Zásady OÚ, Cookies (tabulka z inventáře), Doprava a platba (ceny z backendu, bez PlatímPak), právní FAQ, storno podmínky na stránce Kurzy. LegalDocument bez CMS. | `storefront/src/lib/legal/documents/**`, `storefront/src/modules/legal/**`, právní routy `(main)/{smluvni-podminky,reklamacni-rad,reklamacni-protokol,odstoupeni-od-smlouvy,ochrana-osobnich-udaju,cookies,doprava-a-platba}/**`, `(main)/dotazy/**`, `modules/dotazy/**`, `(main)/kurzy/page.tsx` + nová sekce v `modules/kurzy/Podminky/**` |
| **B — Checkout a objednávka** | Tlačítko „Objednávka zavazující k platbě“ (všechny cesty vč. express), předsmluvní souhrn, checkbox OP + uložení verze a času (server stamp), zakázka: checkbox poučení + štítek u ceny, kurzy: checkboxy + uložení k rezervaci + e-mail, poukaz s vlastní hodnotou, doprava „od X“ v košíku (SK/EUR), zobrazení souhlasů v adminu | `storefront/src/modules/checkout/**`, `modules/express-checkout/**`, `modules/common/components/comgate-payment-selector/**`, `modules/cart/**`, `modules/common/components/cart-totals/**`, `lib/constants.tsx`, `lib/data/cart.ts`, `lib/util/commission.ts`, `modules/products/ProductPage/product/details/details.tsx` + nové komponenty v `modules/products/components/{made-to-order-notice,voucher-amount}/**`, `modules/kurzy/RezervaceModal/**`, `lib/data/courses.ts`; backend `modules/course/**`, `api/store/courses/reservations/**`, `workflows/steps/get-custom-price.ts`, nový `lib/voucher.ts`, nový subscriber `subscribers/order-consent.ts`, nový admin widget `admin/widgets/order-consent.tsx`, `modules/resend/emails/course-*.tsx`, nový `src/scripts/legal-voucher-product.ts` |
| **C — PDF a e-maily** | Tisková stránka, `pnpm legal:build` (Playwright → PDF s diakritikou), manifest pro storefront i backend, `legal:upload` do R2 s pevným klíčem (idempotentní), přílohy v Resend (`data.__attachments`), potvrzení objednávky s PDF OP platné verze + poučením/formulářem a předsmluvními informacemi, patička e-mailů (identita prodávající), patička webu (Reklamační řád, PDF ke stažení) | `storefront/src/app/[countryCode]/(print)/**`, `storefront/src/modules/legal-print/**`, `storefront/scripts/legal-*.mjs`, `storefront/public/legal/**`, `storefront/src/lib/legal/pdf-manifest.json`, `storefront/package.json` (jen scripts), `storefront/src/modules/layout/Footer/**`, backend `lib/legal/**`, `scripts/legal-upload.mjs`, `package.json` (jen scripts), `modules/resend/service.ts` (část send/attachments), `modules/resend/emails/order-placed.tsx`, `modules/resend/components/email-ui.tsx`, `workflows/send-order-confirmation.ts` |
| **D — Odstoupení online (§ 1830a)** | Tlačítko „Odstoupit od smlouvy“ v účtu a přes podepsaný odkaz (e-mail o odeslání) → předvyplněný formulář → „Potvrdit odstoupení od smlouvy“ → uložení + e-mail s obsahem, datem a časem; lhůta od převzetí; výjimka po položkách (zakázka); potvrzení přijetí reklamace s datem | `storefront/src/modules/order/components/{refund-request,withdrawal}/**`, `(main)/order/[id]/{refund,odstoupeni}/**`, `modules/order/templates/order-{details,completed}-template.tsx`, `lib/data/claims.ts`, `lib/util/claims.ts`; backend `lib/claims/**`, `api/store/orders/[id]/claims/**`, `modules/return-request/**`, `modules/resend/emails/{refund-request,order-shipment}.tsx`, `subscribers/customer-emails.ts` (jen handler odeslání) |
| **E — Cookies** | Lišta „Přijmout vše“ / „Odmítnout vše“ / „Nastavení“ rovnocenně, GA jen po souhlasu (Consent Mode v2, výchozí denied, jen s `NEXT_PUBLIC_GA_MEASUREMENT_ID`), Mapy Google až po kliknutí, lišta i v checkoutu (funkční „Nastavení cookies“), údržba inventáře | `storefront/src/modules/layout/CookieNotice/**`, `lib/util/cookie-consent.ts`, nové `modules/analytics/**`, `app/layout.tsx`, `app/[countryCode]/(checkout)/layout.tsx`, `(express-checkout)/**/layout.tsx`, `(main)/layout.tsx` (jen montáž lišty), `modules/layout/ContactDialog/**`, `lib/legal/cookies-inventory.ts` |
| **F — Slevy, recenze, řazení** | Historie cen (modul + job + store API), „nejnižší cena za 30 dní před slevou“ na stránce produktu i kartě, kusy s vadou „cena kusu s uvedenou vadou“ bez přeškrtnutí, štítek zakázky na kartě, recenze: ověření nákupu + pravdivý štítek + text o ověřování, tooltip k řazení | backend nový `modules/price-history/**`, `medusa-config.js` (registrace), `jobs/record-price-history.ts`, `api/store/price-history/**`, `modules/product-review/**`, `workflows/create-review.ts` + kroky, `api/store/reviews/**`; storefront `ProductPage/product/details/Cta/Price/**`, `modules/store/Shop/components/{ProductCard,ShopToolbar}/**`, `modules/products/components/product-reviews/**`, `lib/data/price-history.ts` |
| **G — Poptávka zakázky** | Formulář na stránce Výroba (popis, rozměr, motiv, fotky, termín, kontakt, povinný souhlas s OP a informace o zpracování OÚ) → backend → e-mail majitelce + potvrzení zákazníkovi | `(main)/vyroba/**`, `modules/vyroba/**`, `lib/data/commission-inquiry.ts`; backend `api/store/commission-inquiries/**`, `modules/resend/emails/commission-inquiry-*.tsx`, `modules/resend/service.ts` (jen registrace šablon) |
| **H — Testovací prostředí** | Lokální sandbox (vestavěný Postgres, bez Redis, bez R2, e-maily do souborů), seed (běžný produkt, zakázka, poukaz, kurz), testovací objednávky přes storefront, kontrola `order.metadata` a zachycených e-mailů | `backend/sandbox/**`, `storefront/e2e/legal/**` |

Pravidla pro všechny workstreamy:
- Nesahat na soubory mimo svůj seznam (sdílené: `modules/resend/service.ts` C+G — minimální lokální úpravy, před každou úpravou soubor znovu načíst). Potřeba mimo seznam → hlásit orchestrátorovi.
- Žádné zápisy do produkce (DB, R2, Resend), žádné git operace (commitne orchestrátor po ověření).
- Fakta jen z `facts.ts`; chybějící = `[[DOPLNIT]]` + záznam do OPEN_QUESTIONS (přes report orchestrátorovi).
- Typecheck (`storefront: npx tsc --noEmit`, `backend: pnpm typecheck`) a unit testy pro novou logiku.

Pořadí: A–G paralelně → ověření orchestrátorem po každém → H (potřebuje hotové A–G) → kontrolní agent (checklist sekce 9) → opravy → build, rebase, push, PR.

---

## 4. Otevřené otázky
Viz `docs/legal/OPEN_QUESTIONS.md`.

## 5. Stav
- [x] Průzkum, jádro, plán (14. 10. 2026) — `082f370`
- [x] E Cookies — `2a0f1e4`
- [x] G Poptávka zakázky — `cfcf1a6`
- [x] F Slevy, recenze, řazení — `d55bd56`
- [x] B Checkout — `3cd1bc3`, doplňky `105069e`
- [x] D Odstoupení online — `131dd83`, doplňky `0f9777b`
- [x] C PDF a e-maily — `8914c01`, PDF `5a5e78d`
- [x] A Texty — `bdefc2c`, Segment `66179a8`
- [x] H Testovací prostředí a testovací objednávky — `850baaf`, `53adaf7` (výsledky
      v `backend/sandbox/.artifacts/report.md`, mimo git); oprava webhooku ComGate `25ce69b`
- [x] Kontrolní agent — checklist sekce 9: tři kola; opravy `db363b6`, `84744aa`,
      `95b0483`, `18fb12e`. Závěr: všechny body „V kódu“ i textové body proveditelné bez
      Lucie splněné; zbytek čeká na údaje, data a advokáta (OPEN_QUESTIONS).
- [x] Build (storefront `next build`, backend `medusa build`), lint, typecheck, 1448 unit testů
- [ ] Push větve a PR (rebase není potřeba — `main` se od odbočení nepohnul)

## 6. Nasazení (pořadí)

Backend a storefront nasadit **spolu** — nový backend vyžaduje souhlasy u rezervace kurzu,
starý storefront by dostal 400.

1. Backend: migrace (`medusa db:migrate`): course `Migration20261014120000` (souhlasy),
   return-request `Migration20261014200000` (submitted_at, channel, takeover_at),
   price-history `Migration20261014153217`, product-review `Migration20261014153743`
   (verified_purchase + doplnění u starých recenzí), nový modul email-optout
   `Migration20261015120000` (tabulka `email_opt_out` — odmítnutí proseb o recenzi, poklesu
   ceny a připomenutí košíku; modul je registrovaný v `medusa-config.js`, bez migrace by job
   recenzí i poklesu cen padal na chybějící tabulku). Odkaz v e-mailech potřebuje
   `BACKEND_PUBLIC_URL` (nebo `MEDUSA_BACKEND_URL`), jinak se řádek s odkazem nevykreslí.
2. Backend jednou: `npx medusa exec ./src/scripts/backfill-price-history.ts`.
3. Produkt poukazu „1 Kč“: `npx medusa exec ./src/scripts/legal-voucher-product.ts`
   (suchý běh), pak s `--apply`; popis upravit ručně (OPEN_QUESTIONS #13).
4. Storefront: volitelně `NEXT_PUBLIC_GA_MEASUREMENT_ID` (OPEN_QUESTIONS #18, #24).
5. Po doplnění údajů ve `facts.ts`: `pnpm legal:build` (běžící storefront), `pnpm legal:upload`,
   commit manifestů, nasazení — teprve pak jdou OP a poučení jako PDF do e-mailů.
