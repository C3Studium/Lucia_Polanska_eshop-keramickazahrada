# Keramická zahrada – právní audit e-shopu, 2. kolo

Datum: 18. 10. 2026 · Autor: Matěj Forejt (ValeStudium) · Obchod: https://store.matejforejt.com/cz (ostrá doména keramickazahrada.cz) · Repo: C3Studium/Lucia_Polanska_eshop-keramickazahrada

Toto je kontrola po prvním kole (audit ze 14. 10. 2026, dále „audit 1“). Kontrolovaly se tři věci: produkční web, větev `legal/compliance-2026` v repu (31 commitů, 448 souborů, 15.–16. 10.) a dokumentace agenta (`docs/legal/CHANGELOG.md`, `OPEN_QUESTIONS.md`, `00-plan.md`). Klíčové nálezy changelogu byly ověřeny přímo v kódu (OP 2026, checkout, odstoupení, consent mode, manifest PDF) a u zveřejněných PDF staženo a přečteno PDF Reklamačního řádu.

---

## 1. Souhrn

**Práce je hotová, ale není nasazená.** Produkční web (store.matejforejt.com) je k 18. 10. slovo od slova stejný jako 14. 10.: OP z roku 2015, PlatímPak, prázdné tlačítko, 6 měsíců, přepravní škoda na zákazníkovi. Všechny opravy leží na větvi `legal/compliance-2026`, která není sloučená do `main` (poslední commit v `main` je ze 14. 10., merge-base = HEAD `main`, konflikt tedy nehrozí) a není otevřený PR.

Co je na větvi, odpovídá auditu 1 téměř beze zbytku a jde v několika místech dál (verzovaný registr dokumentů s neměnným vydaným zněním, opt-out e-mailů jedním kliknutím, Segment bez osobních údajů, vlajky bez CDN, mapa až po kliknutí, ověřené recenze). Kvalita je vysoká — dokumenty mají věcně správné paragrafy, kód ukládá verzi OP a čas souhlasu k objednávce, § 1830a flow je dvoukrokový s potvrzovacím e-mailem.

Co brání spuštění, jsou tři věci, které agent udělat **nemohl**:

| Blokátor | Proč to stojí | Kdo to odblokuje |
| --- | --- | --- |
| **Údaje od Lucie** (číslo účtu, DPH, záloha %, storno kurzů, platnost poukazu, zůstatek poukazu, odhad nákladů na vrácení, min. věk, vyzvednutí z kurzu, nástroj newsletteru) | OP 2026, Odstoupení a Zásady jsou jen **pracovní znění** s `[[DOPLNIT]]` → nejsou vydané jako PDF → potvrzovací e-mail objednávky **neposílá OP v příloze** (§ 1827 odst. 2 OZ nesplněn) a patička nabízí jen 3 PDF | Lucie (vyplní v administraci → Právní údaje), pak `pnpm legal:build` + `legal:upload` |
| **Merge + nasazení na Railway** | migrace DB (5 ks), backfill historie cen, skript poukazu, CMS proměnné na storefront, smazat `SEGMENT_WRITE_KEY`, seed Studia | Matěj (Railway přístup) |
| **Data produktů v administraci** | 27 produktů „NA ZAKÁZKU“ v názvu, profil výroby (= poučení o nevratnosti, záloha, povinné zadání) má **1**; 3 produkty „- SLEVA“ bez akční ceny; testovací kus „TEST“ zveřejněný; poukaz za 1 Kč | Lucie + Matěj (admin) |

Dokud nejsou vyřešené všechny tři, **nespouštět ostrý provoz na keramickazahrada.cz**. Samotný merge + deploy bez údajů od Lucie je ale možný a žádoucí hned — web bude právně výrazně lepší než dnes i s pracovními zněními (ta se zobrazují na webu, jen nejdou do PDF a e-mailů).

---

## 2. Stav položek auditu 1

| # | Oblast (audit 1) | Stav na větvi | Stav v produkci | Zbývá |
| --- | --- | --- | --- | --- |
| 1 | OP 2015 → novela 2023 | ✅ OP 2026-10-15: § 1826a, 12 měsíců („do 1 roku“), § 1832, § 1833, § 1837 d) + j), § 2159, ČOI bez ODR, čl. IX nahrazen odkazem | ❌ stále 2015 | merge + deploy; datum účinnosti → skutečné datum spuštění (OPEN_QUESTIONS #3) |
| 2 | Zakázková výroba | ✅ článek v OP (podle návrhu z auditu), poptávkový formulář na /vyroba, profil výroby na produktu → povinné zadání + checkbox → order metadata, štítek u ceny, rychlé přidání do košíku u zakázky vypnuté | ❌ | záloha % od Lucie; **zapnout profil u 26 produktů** v administraci; rozhodnout „Domovní znamení 6 000 Kč + cena dohodou“ |
| 3 | Odstoupení a vrácení peněz | ✅ nejlevnější doprava, stejný platební prostředek, § 1833, e-mail platná forma, vzorové poučení NV 29/2023 ve znění 66/2026 doslova, prohlášení o § 1837 pryč, lhůta od převzetí + § 607 | ❌ | odhad nákladů na vrácení (Lucie); částečné odstoupení bez vrácení dopravy — potvrdit advokátem (#17a) |
| 4 | Reklamace | ✅ Reklamační řád (nová stránka, PDF **vydané**), protokol s formulářem (PDF vydané), přepravní škoda = vada při převzetí a řeší ji prodávající, 30 dní od uplatnění, potvrzení přijetí s časem, pořadí nároků | ❌ | Lucie musí vědět, že reklamaci u ČP podává ona do 2 prac. dnů (admin ji upozorní) |
| 5 | ČOI / mimosoudní | ✅ plně v OP čl. o sporech, bez ODR, e-mail doplněn | ❌ | — |
| 6 | Kurzy | ✅ článek v OP, poučení § 1837 j) v rezervaci, souhlasy uložené u rezervace a vyžadované backendem, PDF OP k potvrzení | ❌ | storno podmínky (Lucie) — dnes systém vrací 100 % při zrušení do 48 h; min. věk; vyzvednutí |
| 7 | Dárkové poukazy | ✅ článek v OP, poukaz s vlastní částkou propsanou do košíku (validace na serveru) | ❌ poukaz za 1 Kč stále v produkci | platnost, zůstatek, postup uplatnění (Lucie); skript `legal-voucher-product.ts --apply`; ručně vyčistit popis; `no_promo` u poukazů |
| 8 | GDPR | ✅ Zásady podle tabulky auditu, ÚOOÚ, příjemci po službách, mezinárodní přenosy (Railway/R2/Supabase/Resend/Google, DPF/SCC), Segment bez e-mailu a jména | ❌ | nástroj newsletteru potvrdit (Resend); Segment vypnout nebo uvést; účetní; podepsat Railway DPA; advokát k e-mailům z oprávněného zájmu (#16d) |
| 9 | Cookies | ✅ lišta s rovnocenným Odmítnout, nic předem zapnuté, GA jen po souhlasu (Consent Mode v2 `denied`), soupis cookies z kódu, „Nastavení cookies“ funguje i v pokladně, mapa po kliknutí | ❌ | rozhodnout GA ano/ne (#18); Zásilkovna používat? (#21) |
| 10 | Čísla účtů | ✅ natvrdo zapsaný účet z kódu odstraněn, `[[DOPLNIT]]` | ❌ oba staré texty | **Lucie: který účet platí** |
| 11 | PlatímPak | ✅ pryč, platební metody podle skutečnosti; ceník dopravy z backendu (jeden zdroj) | ❌ | — |
| 12 | Prázdné tlačítko v OP | ✅ „Objednávka zavazující k platbě“ v OP i ve všech cestách checkoutu; kurzy „Rezervace zavazující k platbě“ | ❌ | — |
| 13 | Doména v OP | ✅ z `facts` (keramickazahrada.cz) | ❌ | PDF jsou na img.matejforejt.com/legal/ — zvážit vlastní doménu bucketu před spuštěním (#3b) |
| 14 | Tlačítko § 1830a | ✅ v účtu, v potvrzení objednávky, v e-mailech odeslání i doručení (podepsaný odkaz pro hosty), dvoukrokové, e-mail s datem a časem | ❌ | — |
| — | § 12a nejnižší cena 30 dní | ✅ modul historie cen, hodinový zápis; než historie pokryje 30 dní, píše „Nejnižší cena před slevou“ s poznámkou; kusy s vadou bez přeškrtnuté ceny | ❌ | migrace + `backfill-price-history.ts`; opravit 3 produkty „- SLEVA“ (#25) |
| — | Recenze | ✅ „Ověřený nákup“ jen po serverovém ověření (dřív u všech!), vysvětlení moderace | ❌ | migrace `review.verified_purchase` |
| — | Potvrzení objednávky s OP v PDF | ✅ kód hotový, přikládá vydané PDF verze platné pro objednávku | ❌ | **nefunguje, dokud OP 2026 není vydané** (viz blokátor 1) |

---

## 3. Co agent našel navíc (a opravil)

Všechno na větvi, zaslouží si vědět o tom:

- **Segment (Twilio, USA)** dostával při každé objednávce e-mail a jméno zákazníka, Zásady o tom mlčely. Opraveno v kódu; ale **nasazený `main` to pořád dělá** → smazat `SEGMENT_WRITE_KEY` na Railway hned, ještě před merge.
- **„Ověřený nákup“ měly všechny recenze**, aniž se cokoliv ověřovalo — klamavá praktika podle § 5 ZOS.
- **Vlajky z cdn.jsdelivr.net** posílaly IP návštěvníka třetí straně před souhlasem — přesunuty do `public/`.
- **Mapa Google** v kontaktu se načítala bez souhlasu — nově po kliknutí.
- **Lišta cookies** měla tlačítko „Přijmout jen důležité“, které zapínalo i preferenční cookies — verze souhlasu zvýšena, všichni se rozhodnou znovu.
- **Google Analytics se reálně nenačítaly**, ačkoliv stránka Cookies tvrdila opak — kód připraven, zapne se proměnnou.
- **FAQ v CMS odporovalo zákonu** („ozvěte se do 48 hodin“, „nepoužitý výrobek“) — kód tyto dvě odpovědi přebíjí; text ve Studiu stejně opravit.
- **Doběrečné** padalo do součtu „Výrobky“ — opraveno jako vlastní řádek.
- E-maily z oprávněného zájmu (prosba o recenzi, zlevnění oblíbeného) mají **odhlášení jedním kliknutím** (§ 7 odst. 3 z. 480/2004 Sb.) a backend odmítnuté adresy respektuje.
- Starší rozhodnutí z 12. 10. („poškozený balík reklamuje příjemce u ČP“) je zrušené — Lucie o tom musí vědět, protože **teď reklamaci u pošty podává ona**.

---

## 4. Co ještě není v pořádku (nové nálezy 2. kola)

| # | Nález | Závažnost | Co s tím |
| --- | --- | --- | --- |
| A | **Práce není v produkci.** Větev nesloučená, PR neotevřený (podle instrukcí měl být). | Kritické | Merge do `main` + deploy podle `docs/legal/00-plan.md` §6. |
| B | **OP 2026 nejsou vydané** → e-mail bez OP, web bez PDF OP, `pnpm legal:build --check --strict` padá. Příčina: 9 chybějících údajů od Lucie. | Kritické | Získat údaje (viz §5), vyplnit v administraci, vydat. |
| C | `privacy.hosting` a `privacy.newsletterTool` jsou v manifestu `null`, ačkoliv commit z 16. 10. tvrdí, že hosting je ověřený a vyplněný. Buď je hodnota v administraci (ne v repu) a manifest se po ní neregeneroval, nebo chybí. | Důležité | Po deployi ověřit v administraci → Právní údaje; `legal:build` přegeneruje manifest. |
| D | Datum účinnosti **2026-10-15** je pracovní; při vydání později je zpětná účinnost nepřípustná (registr to sám hlídá). Je v názvech souborů i v textu tří dokumentů. | Důležité | Před vydáním přejmenovat verzi na skutečné datum spuštění (postup v OPEN_QUESTIONS #3). |
| E | Reklamační řád a protokol jsou **už vydané** (PDF v R2, neměnné) s datem 2026-10-15 a s textem „kolekce Poškozené“ (je to filtr). | Nízké | Při přejmenování verze (D) vydat znovu; staré PDF zůstane v archivu. |
| F | 26 z 27 produktů „NA ZAKÁZKU“ se prodává jako běžné zboží **s právem odstoupit** — poučení v OP nestačí, musí být u kusu (§ 1820 odst. 1 písm. j). | Kritické pro zakázky | Zapnout profil výroby v administraci (Produkty → Výroba) u všech skutečně individualizovaných. Seznam vypíše agent. |
| G | Storno kurzů: systém dnes vrací 100 % při online zrušení do 48 h a potom jen telefonicky; OP čekají na text od Lucie. Pokud Lucie zvolí jiná pásma, musí se upravit i automatický refund. | Důležité | Rozhodnutí Lucie → jedno místo (`course.cancellation`) + případně úprava refund logiky. |
| H | PDF jsou na `img.matejforejt.com/legal/…` — doména vývojáře, ne obchodu. Právně to nevadí, ale v e-mailu zákazníkovi to vypadá cize a při změně hostingu se odkazy v už odeslaných e-mailech rozbijí. | Nízké | Vlastní doména bucketu (`legal.keramickazahrada.cz` nebo `files.…`) před vydáním OP; `R2_PUBLIC_URL` + `legal:upload`. |
| I | Balné se ukazuje až v košíku, ne u ceny výrobku (§ 1811 odst. 2 OZ — cena včetně všech poplatků). Agent to správně označil jako otázku pro advokáta (#17d). | Důležité | Bezpečnější je uvádět u ceny „+ balné X Kč“ nebo balné do ceny zahrnout. Rozhodnout. |
| J | Railway DPA nepodepsaná; Supabase/Resend/Cloudflare mají DPA v podmínkách. | Nízké | Podepsat (DocuSign na railway.com/legal/dpa). |
| K | Tento audit nemohl zkontrolovat administraci ani databázi (jen repo a veřejný web). Tvrzení o „Právní údaje v administraci“ a stavu produktů jsou z dokumentace agenta. | — | Ověřit po deployi. |

---

## 5. Údaje, které musí dodat Lucie (bez nich nelze vydat OP)

Převzato z `docs/legal/OPEN_QUESTIONS.md` a `ZPRAVA_PRO_LUCII.md`; vyplňuje se v administraci → Právní údaje.

| Údaj | Klíč | Poznámka / doporučení |
| --- | --- | --- |
| Číslo účtu (CZK, příp. EUR) | `bank.account` | Tři kandidáti: 2500675505/2010, 2701281289/2010 (EUR), 7010757121/2010 |
| Plátce DPH ano/ne | `vat.status` | Kód i iDoklad počítají s **neplátcem**; staré OP tvrdily plátce |
| Výše zálohy u zakázky | `mto.deposit` | Doporučeno 30–50 % |
| Storno podmínky kurzů | `course.cancellation` | Doporučeno 7+ dní 100 %, 2–6 dní 50 % nebo přesun, <48 h 0 % — nebo potvrdit dnešní „do 48 h 100 %“ |
| Minimální věk na kurzu | `course.minAge` | — |
| Do kdy vyzvednout výrobek z kurzu | `course.pickupDeadline` | např. 60 dní po výpalu |
| Platnost poukazu | `voucher.validity` | dnes 1 rok |
| Zůstatek poukazu pod hodnotu | `voucher.remainder` | propadá / zůstává na kódu |
| Odhad nákladů na vrácení zboží poštou | `withdrawal.returnCostEstimate` | § 1820 písm. i); např. „obvykle 150–250 Kč, křehký balík“ |
| Nástroj newsletteru | `privacy.newsletterTool` | pravděpodobně Resend (vlastní modul) |
| Hosting | `privacy.hosting` | ověřeno 16. 10.: Railway (Amsterdam), Cloudflare R2, Supabase (Frankfurt), Resend — jen zapsat |

Rozhodnutí (ne údaje): Google Analytics ano/ne · Segment vypnout · Zásilkovna používat? · které produkty jsou skutečně na zakázku · co s „- SLEVA“ produkty · datum spuštění = datum účinnosti.

---

## 6. Pořadí dalších kroků

1. **Hned, i bez Lucie:** smazat `SEGMENT_WRITE_KEY` na Railway Backend (únik e-mailů do USA běží na dnešním `main`).
2. Merge `legal/compliance-2026` → `main` přes PR (build + testy + sandbox Playwright `e2e.mjs`).
3. Deploy backend + storefront spolu (00-plan §6: migrace, backfill, voucher skript, CMS proměnné, seed Studia).
4. Lucie vyplní údaje v administraci; Matěj rozhodne produkty NA ZAKÁZKU / SLEVA / TEST.
5. Přejmenovat verzi dokumentů na datum spuštění, `pnpm legal:build`, `pnpm legal:upload`, commit manifestů, deploy.
6. Ověřit v produkci: právní stránky, 3 → 6 PDF v patičce, testovací objednávka → e-mail s OP v příloze, odstoupení přes tlačítko, reklamace.
7. Advokát: finální OP + tři otázky (#16d e-maily z oprávněného zájmu, #17a částečné odstoupení, #17d balné).
8. Přepnout doménu na keramickazahrada.cz.

---

## 7. Zdroje

- Produkční web 18. 10. 2026: /cz/smluvni-podminky, /odstoupeni-od-smlouvy, /reklamacni-protokol, /doprava-a-platba, /ochrana-osobnich-udaju, /cookies — beze změny proti 14. 10.
- Repo `C3Studium/Lucia_Polanska_eshop-keramickazahrada`, větev `legal/compliance-2026` @ b32a03b (16. 10.), `main` @ 2b7d417 (14. 10.)
- `docs/legal/CHANGELOG.md`, `OPEN_QUESTIONS.md`, `00-plan.md`, `ZPRAVA_PRO_LUCII.md`
- `storefront/src/lib/legal/documents/obchodni-podminky/2026-10-15.ts` (ověřeno: § 1826a, § 2161 odst. 5 „do 1 roku“, § 1832, § 1833, § 1837, § 2159, ČOI, bez ODR/101/2000/PlatímPak)
- `storefront/src/lib/legal/pdf-manifest.json` (3 vydaná PDF, 3 pracovní s chybějícími fakty)
- https://img.matejforejt.com/legal/reklamacni-rad-2026-10-15.pdf (staženo, diakritika OK, 12 kapitol, 1 rok / 30 dní / přeprava správně)
- `storefront/src/modules/analytics/consent-mode.ts` (výchozí `denied`), `modules/order/components/withdrawal/` (§ 1830a flow), `modules/checkout/components/payment-button/` (text tlačítka)
- Audit 1 (14. 10. 2026) a jeho právní zdroje: OZ § 1810–1867, § 2158–2174; ZOS § 12a, § 14, § 19; novela 374/2022 Sb.; NV 29/2023 Sb. ve znění NV 66/2026 Sb.; zrušení ODR 20. 7. 2025; § 1830a (směrnice 2023/2673)
