# Opravy e-shopu 13. 11. 2026 — plán

> Provádí jeden implementátor v této session (bez subagentů — majitel výslovně). Kroky `- [ ]`.

**Goal:** Opravit a zjednodušit obchod, košík, pokladnu, účet a domovskou stránku podle Matějova seznamu z 13. 11. 2026.

**Architecture:** Úpravy přímo v pracovním stromu `feat/obchod-jednoduchy`; `next dev` na :8000 je vidí hned. Logika, která rozhoduje (katalog, výběr řádků, ceny kurzů), jde do malých čistých funkcí s testem; vzhled se ověřuje skriptem Playwright na 4 velikostech.

**Tech Stack:** Next.js 15 (storefront), Medusa v2 (backend), SCSS moduly, Playwright, Jest (backend).

**Spec:** Matějův seznam v konverzaci 13. 11. 2026 (body 1–5 košík/pokladna, „accounts" 1–12) + dřívější: kurzy jen dospělý/dítě do 15 let.

## Global Constraints

- E-shop bez animací (PlainShop, fb2277b0); tmavý podklad zůstává.
- Telefony `--ui-scale 0.8`, podlaha písma `max(10px, …)`, dotykové cíle 44 px, kruhová tlačítka `min-height: 0 !important` + `::after`.
- Ověřovací velikosti: 390×844 (dotyk), 844×390, 1024×1366, 1728×1117.
- Nespouštět/nezastavovat :8000 a :8099; žádný `next build` do `.next`. Produkce jen ke čtení. Žádné commity bez pokynu. Edge okno (:4601) a telefon (:4602) jen když o to Matěj požádá.
- Názvy výrobků: v košíku/pokladně/přehledu max 3 slova + „…"; všude jinde max 2 řádky.

## Review Focus

1. Návrat Zpět z výrobku na telefonu (Safari zahazuje stránku) → stejné filtry i poloha.
2. Obnovení stránky obchodu s filtry → stejné filtry i poloha; vstup z menu → nahoře, bez filtrů.
3. Klik na filtr, který výsledek nezmění (např. „Všechno" když už je vybráno) → poloha se nehne.
4. Stará objednávka s řádkem „Doběrečné" → v přehledu jako platba, ne jako výrobek; součty sedí.
5. Košík přes `http://192.168.1.31:4700` na iPhonu → položka v košíku zůstane.

---

### Task 1: Košík a přihlášení přes http (telefon)
**Files:** Modify `storefront/src/lib/data/cookies.ts:58,80,104`
- [ ] `secure` jen když `NEXT_PUBLIC_BASE_URL` začíná `https:` (produkce zůstává secure).
- [ ] Ověřit: Playwright webkit na `http://192.168.1.31:4700`… (po buildu do `.next-ios`) — nebo aspoň cookie bez `Secure` v odpovědi `addToCart`.

### Task 2: Katalog obchodu rychle (filtry)
**Files:** Modify `storefront/src/lib/data/products.ts` (`listStoreCatalogue`), Create `storefront/src/lib/util/catalogue-filter.ts`
**Interfaces:** Produces `filterCatalogue(all: StoreProduct[], filters: ShopFilters, ctx): { products, count }` (čistá funkce: kategorie, kolekce přes kategorie, novinky, sleva, druh, cena, hledání, řazení).
- [ ] Naměřeno dnes: 1,2–2,6 s na klik (Květiny 1629 ms, Do bytu 1196 ms, Zvonková 2639 ms).
- [ ] Celý katalog regionu (≈260 ks, pole jako dnes) jednou do `unstable_cache` (klíč region, tag `products`, 60 s); `listStoreCatalogue` už jen filtruje a stránkuje v paměti.
- [ ] Playwright: klik na filtr < 400 ms při teplé cache.

### Task 3: Poloha a filtry obchodu (nejdůležitější)
**Files:** Modify `storefront/src/modules/store/Shop/index.tsx`, `storefront/src/modules/store/Shop/restore.ts`, Create `storefront/e2e/tests/store-scroll.spec.ts`
- [ ] Změna filtru: na začátek katalogu JEN když se změnil výpis (`podpisVypisu` před/po); jinak poloha beze změny. Nikdy na úplný začátek/konec stránky.
- [ ] Obnovení stránky (`performance.getEntriesByType("navigation")[0].type === "reload"`): filtry z adresy (už jsou) + poloha ze `sessionStorage` (ukládat na `pagehide`/scroll throttle), dorolovat až po načtení výšky (`obnovPozici`).
- [ ] Vstup odjinud (ne reload, ne back): nahoře, adresa bez filtrů.
- [ ] Zpět z výrobku: dnešní snímek (`prisliJsmeZpet`) ověřit na telefonu; `history.scrollRestoration = "manual"` jen pro obchod, ať se nepere s Lenisem.
- [ ] Spec: 5 scénářů z Review Focus 1–3 na 390×844 a 1728×1117.

### Task 4: Přidání do košíku bez skoku
**Files:** `storefront/src/modules/products/ProductPage/product/details/Cta/*`, `storefront/src/modules/store/Shop/components/ProductCard/index.tsx`, `storefront/src/lib/data/cart.ts`
- [ ] Najít příčinu skoku (revalidace → přemontování / otevření košíku / focus) měřením `scrollY` před a po; opravit u kořene, ne vracením polohy.
- [ ] Ověřit: poloha ±2 px po přidání na detailu i z karty, telefon i laptop.

### Task 5: Košík (Bauhaus)
**Files:** `storefront/src/modules/cart/templates/*`, `storefront/src/modules/cart/components/item/*`, `storefront/src/modules/layout/components/cart-dropdown/*`, Create `storefront/src/lib/util/short-title.ts` (`shortTitle(title: string, words = 3): string`)
- [ ] Souhrn vpravo širší (mřížka 8/4 sloupce na laptopu, pod sebou na telefonu).
- [ ] Tlačítka v designu webu (WebButton / premium-action-button) bez animací.
- [ ] Řádek výrobku: menší fotka, název `shortTitle`, ceny ve sloupci (akční, původní přeškrtnutá, balné), množství a součet zarovnané.
- [ ] Telefon: −/1/+ a „Odebrat" i ikony vystředěné (v rozbalovacím košíku je dnes „−" níž než „1").

### Task 6: Pokladna (Bauhaus)
**Files:** `storefront/src/app/[countryCode]/(checkout)/checkout/page.tsx` + `page.module.scss`, `storefront/src/modules/checkout/templates/*`, `checkout/components/step-list`, `step-bubbles`
- [ ] Pryč „Ještě pár kroků." vlevo; číslo + název + podtitul kroku do hlavičky formuláře.
- [ ] „Co objednáváte": `shortTitle`, sloupce cen jako v košíku.
- [ ] Rozvržení pro laptop, tablet, telefon na výšku (víc mezer, jednodušší).

### Task 7: Názvy výrobků a podtitul
**Files:** `storefront/src/modules/products/ProductPage/product/details/details.tsx` + `style.scss`, `storefront/src/modules/store/Shop/components/ProductCard/style.module.scss`, `storefront/src/modules/order/**`
- [ ] Velikost názvu tak, aby nejdelší skutečný název měl max 2 řádky (detail, karta, objednávka); `line-clamp: 2` jen pojistka.
- [ ] Smazat „Vyrobeno rukama, jen jednou." pod názvem.

- [x] 404 u `zvonkové-tlačítko-jeřabina`: handle z adresy přišel zakódovaný → `productHandle()` v `app/[countryCode]/(main)/products/[handle]/page.tsx` (decode + NFC). Ověřeno: 200 a „Přidat do košíku".

### Task 8: Galerie výrobku
**Files:** `storefront/src/modules/products/ProductPage/product/Gallery/gallery.tsx` + styl
- [ ] Hlavní fotka s šipkami ←/→ (i klávesy a tah prstem), pod ní řada náhledů jako tlačítka (`aria-current`); výběr varianty přepne na její fotky. Bez animací.

### Task 9: Dobírka jako platba
**Files:** Create `storefront/src/lib/util/payment-fee-lines.ts` (`splitPaymentFee(items): { products, paymentFee }`), použít v košíku, pokladně, přehledu, objednávce; backend `backend/src/lib/email-items.ts` (e-maily).
- [ ] Rozhodnutí: technicky zůstává řádek (`backend/src/lib/dobirka-fee.ts` — na něm stojí součty, iDoklad, štítek ČP, reklamace; přestavba přes 30 souborů není úměrná). Zákazník ho vidí jen jako „Příplatek za dobírku" v ceně vedle Dopravy, nikdy mezi výrobky ani v počtu kusů.
- [ ] Platí i pro staré objednávky (#7x). Unit test `splitPaymentFee` na řádku z `dobirka-fee.ts`.

### Task 10: Účet
**Files:** `storefront/src/modules/order/components/withdrawal/entry.tsx` (+ 3 klientské rodiče), `storefront/src/app/[countryCode]/(main)/account/loading.tsx`, `@dashboard/loading.tsx`, komponenta hesla s okem, `storefront/src/lib/data/customer.ts`, `backend/src/subscribers/handle-reset-password.ts`, `backend/src/lib/storefront-url.ts`
- [ ] Detail objednávky / reklamace / odstoupení: `WithdrawalEntry` async v klientském stromu → texty načíst na serveru a poslat jako props; opravit doslovný `{texty["order.withdrawal_2"]}` a „…do $".
- [ ] Kostra účtu jen pro přihlášeného (bez cookie `_medusa_jwt` kostra přihlášení).
- [ ] Heslo: jedno oko (`::-ms-reveal`/`::-webkit-credentials-auto-fill-button` pryč), vystředěné s textem.
- [ ] Obnova hesla: projít celou cestu na sandboxu :9100 (žádost → token → odkaz → nové heslo → přihlášení); na produkci jen čtení logů. Opravit každý rozbitý krok.

### Task 11: Domovská stránka a kurzy
**Files:** `storefront/src/modules/home/E-com/index.tsx`, smazat `storefront/src/modules/home/E-com/ShopInvite/`, `storefront/src/styles/_generated-styles.scss`, 35 souborů s „↗", styl obrázků voleb kurzů
- [ ] Pryč sekce za 3D kurzů (ShopInvite).
- [ ] „↗" na iPhonu jako emoji → `↗︎` / `\2197\FE0E` všude.
- [ ] Tři obrázky voleb kurzů `aspect-ratio: 16 / 9`.
- [ ] „Zobrazit celý e-shop →" vystředěné.

### Task 12: Kurzy — dospělý a dítě (rozpracováno)
**Files:** hotovo backend `pricing.ts`, testy, admin; zbývá `storefront/src/modules/kurzy/format.ts`, `RezervaceModal/index.tsx`, `Rezervace/index.tsx`, texty `kurzy.rezervacemodal_11` (storefront `lib/constants/texty.ts` + backend `lib/shop-texty.ts`)
- [ ] Žebříček cen: „Dospělý" + „Dítě do N let"; pryč „Dva lidé / Od 3 lidí" a věta „Čím víc vás přijde…".

### Task 13: Ověření
- [ ] `npx tsc --noEmit` storefront i backend, backend jest pro dotčené moduly.
- [ ] Playwright snímky 4 velikostí pro obchod, výrobek, košík, pokladnu, účet, domů.
- [ ] Na Matějův pokyn: Edge (:4601) a iPhone (:4602).
