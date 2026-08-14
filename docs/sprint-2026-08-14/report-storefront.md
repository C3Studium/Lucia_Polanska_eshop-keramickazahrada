# Report — full storefront audit (read-only), 2026-08-14

Auditované HEAD: `0c892ba` („Balíkovna: oficiální widget v checkoutu…"), pracovní strom čistý
(kromě netrackovaných `FINISHINGTODOLIST.md` a `docs/sprint-2026-08-14/`).
Všechny cesty jsou relativní k `storefront/`, pokud není uvedeno jinak; backend cesty mají prefix `../backend/`.

**Baseline:** `npx tsc --noEmit` prošlo bez chyb (exit 0).

---

## 1. Confirmed (prior audit 2026-08-14)

### Legal pages
- Nevyplněný název tlačítka objednávky „ “ — `src/app/[countryCode]/(main)/smluvni-podminky/data.ts:36`.
- Prázdná e-mailová adresa pro mimosoudní stížnosti („prostřednictvím elektronické adresy .“) — `data.ts:106`.
- Utnutý výčet osobních údajů („telefonní číslo a (dále…“) — `data.ts:116`.
- Citace zrušeného zákona 101/2000 Sb. — `data.ts:115`.
- Chybí ADR/ODR klauzule (ČOI jako subjekt mimosoudního řešení, odkaz na platformu ODR) — sekce VIII má jen dozorové úřady, `data.ts:101-110`.
- Datace „Obchodní podmínky platné od 1.1. 2015“ / „V Písku dne 1.1. 2015“ — `data.ts:141-142`; táž datace v hlavičce `smluvni-podminky/page.tsx:139`.
- Bankovní účty 2500675505/2010 (CZK) + 2701281289/2010 (EUR) v podmínkách — `data.ts:56` — vs. `src/lib/data/merchant.ts:35-37` (7010757121/2010, IBAN CZ34…7121). Rozpor trvá; `FINISHINGTODOLIST.md` §3 ho eviduje jako otevřené rozhodnutí.
- Zabudované TODO v textu podmínek — `data.ts:81-82`.
- `ochrana-osobnich-udaju/page.tsx`: korporátní šablona — „Jsme společnost“ (:21), „Společnostmi v rámci naší skupiny“ (:56), žádní konkrétní zpracovatelé (:55-59), ve výčtu práv (:83-91) chybí právo podat stížnost u ÚOOÚ.
- `cookies/page.tsx`: sekce, jejíž celé tělo je slovo „Cookies“ (:22-25); tvrzení o Google Analytics a „nastavení cookies“, které neexistují (:79); mrtvý odkaz „na konci této stránky“ (:18).
- `odstoupeni-od-smlouvy/page.tsx`: pouze vzorový formulář (:16-76), žádná próza o postupu a lhůtách, ačkoli metadata slibují „postup, lhůty“ (:12-13).
- `doprava-a-platba/page.tsx`: duplicitní rozporné ceníky — výdejní místa 79 Kč (:31) vs. „varianta 2“ 89 Kč (:52-54); adresa 95 Kč (:39) vs. 99 Kč (:62) vs. třetí sekce 99 Kč (:67-72); zaniklé „PlatímPak / Equa Bank“ (:110-115); prázdné sekce-oddělovače (:20, :25, :85, :181).
- Reklamační řád pod třemi jmény: stránka se jmenuje „Reklamační protokol“ (`reklamacni-protokol/page.tsx:13`), checkout/objednávka na ni odkazuje jako na „reklamační řád“ (`src/modules/order/components/carrier-damage/index.tsx:107`), obchodní podmínky mluví o „reklamačním řádu prodávajícího“ (`smluvni-podminky/page.tsx:125`).
- `reklamacni-protokol/download.tsx:13` `PROTOCOL_PDF_PATH = null` + TODO (:6-11); viditelný blok „Dokument sem doplníme“ v `carrier-damage/index.tsx:95-102` + TODO (:93-98).

### Consent, cookies
- Hlavní checkout: souhlas s podmínkami HOTOVÝ a správně — checkbox `src/modules/checkout/components/review/index.tsx:201-224`, `TERMS_VERSION = "2026-08"` (:29), `recordConsent` zapisuje `terms_accepted_at` + `terms_version` do cart.metadata před založením platební session (:82-90, volání :101), tlačítko gated na `accepted` (:249, :260-270). Platí — ale viz Nové nálezy N-05 (záznam se zapisuje jen na ComGate cestě).
- Express checkout: ŽÁDNÝ checkbox — jen věta „Potvrzením objednávky souhlasíte s obchodními podmínkami“ bez odkazů, `src/modules/express-checkout/Payment/index.tsx:202-205`; prázdný seznam bran = slepá ulička s hláškou bez další akce (:207-211).
- Footer newsletter: souhlas je věta, ne opt-in checkbox — `src/modules/layout/Footer/index.tsx:393` („Odesláním souhlasíte…“).
- Cookie lišta informativní a pravdivá — `src/modules/layout/CookieNotice/index.tsx:14-19, 56-62`; grep celého `src/` nenašel žádnou analytiku (gtag/GTM/posthog/plausible/pixel: 0 výskytů) → lišta je v pořádku, ale **rozporuje ji cookies stránka** (GA tvrzení `cookies/page.tsx:79`, „statistické potřeby“ :58, „mix cookies první a třetí strany“ :44).

### SEO
- `next-sitemap.js` mrtvý: balíček `next-sitemap` není v `package.json` (žádná dependency, žádný `postbuild` skript) a config má concat bug — `exclude: excludedPaths + ["/[sitemap]"]` (pole+pole = string `"/checkout,/account/*/[sitemap]"`), `next-sitemap.js:6`.
- Žádný `robots.ts`/`sitemap.ts` nikde v `src/app` (find: 0). Žádný noindex mechanismus pro staging (grep „noindex“ v `src/`: 0) — `FINISHINGTODOLIST.md` §5 ho plánuje, v kódu není.
- `src/app/opengraph-image.jpg` + `twitter-image.jpg` = Medusa starter „Next.js Starter Template“ obrázek (vizuálně ověřeno, oba 234 193 B, 1600×900).
- `generateMetadata` jen na `products/[handle]/page.tsx` a `account/@dashboard/orders/details/[id]/page.tsx` (grep celého `src/app`).
- Žádné canonical alternates nikde; `src/lib/util/env.ts:2` fallback `https://localhost:8000` → `metadataBase` v `src/app/layout.tsx:8`.
- `public/favicon.ico`: 4 ikony 16/32 px, datovaný z r. 2025 — zda jde o starter favicon je **UNVERIFIED** (nelze porovnat bez referenčního souboru).

### Robustness
- Žádný `error.tsx` ani `global-error.tsx` v celém `src/app` (find: 0; loading.tsx jich je 13).
- `return null` → prázdná 200: homepage `(main)/page.tsx:38-40`, `kurzy/page.tsx:30-32`, `o-mne/page.tsx:32-34`.
- Holé Sanity `client.fetch()` bez catch: homepage :31-36, kurzy :27, o-mne :30 (o-mne výsledek `settings` navíc nikde nepoužívá).
- `src/sanity/env.ts:4-12` hází výjimku při importu, chybí-li env.
- `(express-checkout)/not-found.tsx:11` překlep `100dv` (má být `100dvh`) → neplatný calc, min-height nefunguje.
- `(main)/not-found.tsx:12-19` starter Tailwind utility (`text-2xl-semi text-ui-fg-base`) — třídy fungují (preset `@medusajs/ui-preset` je v `tailwind.config.js:5`), ale vzhled je mimo design systém.

### Data honesty / cleanup
- Wishlist stránka: 10 console volání včetně dumpu celých dat — `account/@dashboard/wishlist/page.tsx:25,28,48,54,63,67,70,73,77` a `:124` (`console.log("Fetched wishlist items", wishlistItems)`).
- Reviews stránka: 9 console volání — `account/@dashboard/reviews/page.tsx:45,55,64,68,71,76,80` a `:122` (dump celého pole produktů); mrtvý neimportovaný `DebugReviewsLogger.tsx` (grep: 0 užití).
- `TODO.md` dluhy trvají: „FIX the filtering search issue“ (:18), account mockup data (:30), bundles (:35-36), skeletony (:79-96). Pozn.: `TODO.md` je v `.gitignore` (řádek `TODO.md`).
- `profile-email` update je no-op: `updateCustomer` zakomentovaný, hlásí success bez akce — `src/modules/account/components/profile-email/index.tsx:19-33`.
- `order-completed-template.tsx:86` TODO(BACKEND) — fixní masthead „Máme ji“ bez ohledu na fulfillment_status.
- `products/[handle]/page.tsx:133` holé `@ts-ignore` (+ WIP komentář :123).
- `src/lib/data/navigation.ts:26` `SEED_CATEGORY_HANDLES` filtr demo kategorií + TODO(backend) :17-24.
- NavbarSearch stahuje celý katalog klientskou smyčkou — `src/modules/layout/Navbar/navbarSearch/index.tsx:575-611` (TODO(search-service) :575-577).

### Env/config
- `next.config.js`: `http://localhost` image pattern natvrdo (:27-30), hardcoded `bucket-production-2be7.up.railway.app` (:53-56), tři medusa demo S3 hosty (:41-51, s poznámkou „can be removed after deleting demo products“).
- `check-env-variables.js:3-9` validuje jedinou proměnnou (publishable key).
- `.env.local.template:8` `NEXT_PUBLIC_DEFAULT_REGION=us` (a MeiliSearch bloky, které storefront nepoužívá).
- `NEXT_PUBLIC_CONTACT_FORM_ENABLED` chybí v `.env.local` → formulář v ContactDialog vypnutý (`src/modules/layout/ContactDialog/panel.tsx:53`).
- Hardcoded localhost fallback `http://localhost:9000` v `src/app/api/account/password/route.ts:35`.

---

## 2. Corrected / refuted

- **`tsconfig.tsbuildinfo` „committed“ — REFUTED.** Soubor existuje na disku, ale `git ls-files --error-unmatch tsconfig.tsbuildinfo` → „did not match any file(s) known to git“ a `git check-ignore` ho matchuje (`.gitignore` obsahuje `tsconfig.tsbuildinfo`). Není v repu.
- **„~30 console volání v checkout shipping“ — CORRECTED.** Dnes 13 (`src/modules/checkout/components/shipping/index.tsx:126,146,152,185,192,268,274,328,379,386,397,402,416`), vesměs error-path; debug dump odstraněn (:264 „(removed debug logging)“).
- **„7 console.logs ve wishlist / 5 v reviews“ — CORRECTED (počty).** Dnes 10 ve wishlist, 9 v reviews (viz sekce 1); charakter nálezu trvá.
- **„store, collections, categories, search, results bez metadata“ — PARTIALLY CORRECTED.** `/store` má statické `metadata` (`store/page.tsx:18-22`). Collections, categories, search i results jsou dnes **permanentRedirect na /store** (`collections/[handle]/page.tsx:14-16`, `categories/[...category]/page.tsx:13-18`, `search/page.tsx:14`, `results/[query]/page.tsx:14-16`) — metadata tam už nedávají smysl; TODO.md sekce „Search page — create a mockup page“ je zastaralá.
- **„English cart-mismatch-banner + free-shipping-price-nudge“ — CORRECTED.** Obojí je česky (`cart-mismatch-banner/index.tsx:51-56, 87` „Propojit košík“; `free-shipping-price-nudge/index.tsx:197,250,256` „Doprava zdarma / Otevřít košík / Nakupovat dál“).
- **„Account mockup data“ — LARGELY RESOLVED.** Preview fallbacky jsou zakomentované: wishlist `page.tsx:126-133`, reviews `page.tsx:138-145`, product-reviews (`src/modules/products/components/product-reviews/index.tsx` — celé pole previewReviews v komentáři, `displayedReviews = reviews` :113-122). Dashboard čte reálná data (`account/@dashboard/page.tsx:14-26`). Zbývá jen no-op `profile-email` (viz sekce 1) — detail v D6.
- **„wishlist-toggle debug logging“ (TODO.md :100) — OUTDATED.** `src/modules/products/components/wishlist-toggle.tsx` už žádná console volání nemá (grep: 0).
- **„Express checkout dead end when gateway list is empty“ — PARTIALLY CORRECTED.** Dnes se aspoň ukáže `role="alert"` „Comgate teď není dostupný…“ (`express-checkout/Payment/index.tsx:207-211`) — ale pořád bez alternativy či retry; slepá ulička trvá.

---

## 3. New findings (severity-ranked)

### Blockers
- **N-01 · Osobní odběr a dobírka nejdou dokončit.** Payment krok tyto providery korektně nabídne a založí session (`src/modules/checkout/components/payment/index.tsx:66-79, 161-175, 177-213`), ale finální tlačítko v Review — `PaymentButton` — má switch jen pro `isManual` (`pp_system_default…`) a `isComgate`; `pp_osobni-odber_pickup` i `pp_dobirka_ceska-posta` spadnou do default větve = trvale disabled „Nejdřív vyberte platbu“ (`src/modules/checkout/components/payment-button/index.tsx:34-52`, `src/lib/constants.tsx:118-124`). Objednávku s platbou při vyzvednutí / dobírkou nelze odeslat.
- **N-02 · Staging nevrací ŽÁDNÉ shipping options** — viz sekce 4. Checkout se dnes zastaví na kroku Doručení (prázdný RadioGroup, „Pokračovat k platbě“ disabled — `shipping/index.tsx:739-750`). Pravděpodobně rozpracovaná konfigurace (commit 0c892ba je čerstvý), ale dokud platí, nejde e2e ověřit nic dál a dynamická doprava-a-platba by renderovala prázdno.
- **N-03 · Express checkout: návratové URL z brány vedou mimo express flow a jeho confirmation/result stránky jsou mrtvé.** Express posílá `return_path` a `source` (`express-checkout/Payment/index.tsx:109-110`), ale backend ComGate service čte jen `data.url_paid/url_cancelled/url_pending` a jinak staví fallback `/{cc}/cart/{cartId}/confirmed|canceled|pending` (`../backend/src/modules/comgate/service.ts:268-285`; grep `return_path` v `../backend/src/modules/comgate/` + `api/store/comgate/`: 0). Důsledky: (a) `/express-checkout/result/[status]` a `/express-checkout/confirmation/[id]` nejsou nikdy navštíveny; (b) `completeExpressCart` nemá jediného volajícího (grep `src/`: 0) → express cookie `_medusa_express_cart_id` se nikdy nesmaže (`src/lib/data/express-cart.ts:202-226`); (c) objednávku dokončí až fallback stránka hlavního košíku `/cart/[id]/confirmed` → `placeOrder(cartId)`, který **bezpodmínečně smaže cookie HLAVNÍHO košíku** (`src/lib/data/cart.ts:600-607` `removeCartId()`), takže expresní nákup zákazníkovi zahodí rozpracovaný hlavní košík.

### Must-fix
- **N-04 · `ComgatePaymentButton` fallback redirectu na `provider_id`.** Není-li `session.data.redirectUrl` string, použije se `session.provider_id` („pp_comgate_comgate“) jako URL a `window.location.href` na něj naviguje (`payment-button/index.tsx:110-115, 126`). K tomu mrtvý `postMessage` listener s `redirect()` z `next/navigation` v event handleru po opuštění stránky (:128-137) — nikdy nemůže fungovat.
- **N-05 · Souhlas s podmínkami se ZAZNAMENÁVÁ jen na ComGate cestě.** `recordConsent` se volá pouze v `payWithComgate` (`review/index.tsx:101`); pro manual/pickup/dobírkové objednávky přes `PaymentButton` se `terms_accepted_at`/`terms_version` do cart.metadata nikdy nezapíše (grep `terms` v `payment-button/index.tsx`: 0). Checkbox UI je gated správně, ale důkaz o souhlasu v objednávce chybí. Express checkout nezapisuje nic (žádný checkbox, žádný recordConsent).
- **N-06 · Server log úniku autorizačních hlaviček.** `getProductReviews` loguje `console.log("Headers:", headers)` včetně `authorization: Bearer <jwt>` a publishable key na server — `src/lib/data/products.ts:311-315` (běží při každém renderu detailu produktu).
- **N-07 · Middleware shodí celý web, když backend neodpoví.** `getRegionMap` hází (`src/middleware.ts:19-23, 46-68`) a `middleware()` volá bez try/catch (:138) → jakýkoli výpadek backendu = 500 na všech cestách včetně statických stránek. K tomu prefix bug: `pathname.split("/")[1].includes(countryCode)` (:143) — segment „czech-…“ matchne „cz“.
- **N-08 · `capturePayment` volá neexistující endpoint.** `/store/payment/capture` v backendu není (`../backend/src/api/store/` nemá `payment/`), a přesto ho `PaymentConfirmed` volá při každém návratu z brány (`src/modules/cart/components/payment-confirmed/index.tsx:37`, `src/lib/data/cart.ts:293-320`). „Fails gracefully“, ale je to mrtvý kód na kritické cestě.
- **N-09 · Demo apparel je v obchodě viditelný.** Runtime: `/store/products` vrací `t-shirt`, `sweatpants`, `sweatshirt`, `shorts` (sekce 4). `SEED_CATEGORY_HANDLES` filtr existuje jen pro mega-menu (`navigation.ts:26,93`); `/store` stránka ho NEaplikuje — `store/page.tsx:40-65` staví `categories` i `navCollections` bez něj, takže fallback větev FilterPanelu (`FilterPanel/index.tsx:170-184`) vypíše i shirts/pants/merch, a produkty jsou v gridu. (Úklid dat je backend-side, ale storefront filtr je děravý.)
- **N-10 · EUR ceny se formátují anglicky.** `convertToLocale` má default `locale = "en-US"` (`src/lib/util/money.ts:16`) — slovenský zákazník s EUR uvidí „€5.00“ místo „5,00 €“. CZK má vlastní větev „1 234,-“ (:22-31), volající locale nepředávají.
- **N-11 · Reviews stránka: obohacení recenzí jen prvními 16 produkty + mrtvá login větev.** `listProducts({limit: 16})` (`account/@dashboard/reviews/page.tsx:112-120`) — recenze na produkt mimo prvních 16 zůstane bez obrázku/handle; `if (!customer)` větev (:98-107) je nedosažitelná, protože :95-97 už zavolalo `notFound()`.
- **N-12 · Packeta widget skript se injektuje každému návštěvníkovi checkoutu.** `useEffect` na mountu Shipping bez podmínky na existenci Packeta option (`shipping/index.tsx:266-289`) — third-party skript z `widget.packeta.com`, ačkoli se Packeta nenabízí. Zbytek degraduje korektně: veškerá Packeta UI je gated na `shippingMethodId === packetaShippingMethodId` (env `NEXT_PUBLIC_PACKETA_SHIPPING_METHOD_ID`, `.env.local` obsahuje `so_01K2JN98M2ACBVFCZREZTD2HTF`, který v runtime neexistuje) — když option není v nabídce, nic Packetího se nevykreslí ani nerozbije (`shipping/index.tsx:433-437, 697-728`; express `Shipping/index.tsx:89-97`). Zásilkovna ale zůstává v zákaznickém textu: `doprava-a-platba/page.tsx:121` („Česká pošta, Zásilkovna a PPL“) a heuristika `shippingName.includes("packeta")` v express Payment (`Payment/index.tsx:101-107`).
- **N-13 · Dobírkový poplatek a podmínky v copy vs. realita.** `doprava-a-platba/page.tsx:121` slibuje dobírku za 55 Kč u tří dopravců; skutečná dobírka je opt-in per produkt, jen ČP (`payment/index.tsx:74-76` komentář + `constants.tsx:33-38`), a runtime `pp_dobirka_ceska-posta` vůbec nenabízí (sekce 4). Celá stránka je na dynamické přegenerování (D1).

### Nice-to-have
- **N-14** Prázdný `<div className={styles.packetaSelector}>` v shipping (`shipping/index.tsx:615`).
- **N-15** Kalkulovaná cena dopravy 0 Kč se zobrazí jako „-“ (falsy check `calculatedPricesMap[option.id] ?` — `shipping/index.tsx:596-604`).
- **N-16** `o-mne/page.tsx:30` fetchuje `settings` a nepoužije je (zbytečný Sanity roundtrip).
- **N-17** `public/assets/tee-black-front.webp` — starter leftover (demo tričko) v public.
- **N-18** `paymentInfoMap` nemá záznam pro živý `pp_osobni-odber_pickup` (jen retired `pp_pickup_pickup`) — `constants.tsx:52-100`; `paymentMethodTitle` to zachraňuje fallbackem.
- **N-19** `package.json` pořád „medusa-next“, autor Medusa (:2-7).
- **N-20** `/studio` je veřejně dosažitelná route (Sanity Studio, `src/app/studio/[[...tool]]/page.tsx`; middleware ji vynechává `middleware.ts:127-129`). Auth řeší Sanity samo, ale route prozrazuje CMS a project id; zvážit ochranu/noindex.
- **N-21** Reviews fetch posílá dvě varianty hlaviček publishable key (`x-publishable-api-key` i nestandardní `x-publishable-key`) — `products.ts:301`, `reviews/page.tsx:37`.
- **N-22** `(main)/layout.tsx` dělá 7 sekvenčních awaitů na každé RSC vykreslení (customer, cart, regions, wishlist, navigace, shipping options, shop status — :27-49) — kandidát na `Promise.all`.

---

## 4. Runtime state (staging, read-only, 2026-08-14)

Backend `https://backend-production-81e2.up.railway.app` + publishable key z `.env.local`. Jeden jednorázový košík (`cart_01KZZR581TF3Y7BD6Y72B0PKC9`, region CZ), nedokončen, žádný checkout.

- **Regiony:** Europe (EUR: sk, si, dk, fr, de, it, es, se, gb), Česká republika (CZK: cz), Polsko (PLN: pl).
- **Shipping options: 0.** `GET /store/shipping-options?cart_id=…` vrací `{"shipping_options":[]}` pro CZ košík — prázdný, s položkou (Vlčí mák, 240 Kč), i s CZ doručovací adresou a e-mailem; i po přidání seed t-shirtu (jiný shipping profile) stále 0. Storefront by dnes v checkoutu neukázal žádnou dopravu. Balíkovna/ČP options zjevně ještě nejsou (znovu)zapojené na CZ service zónu — koordinovat s backend reportem.
- **Payment providers (CZ region):** `pp_comgate_comgate`, `pp_osobni-odber_pickup`, `pp_pickup_pickup` (retired, storefront ho filtruje). Žádný `pp_system_default`, žádná `pp_dobirka_ceska-posta`.
- **ComGate methods:** `GET /store/comgate/methods?currency=CZK&country=CZ&price=240` vrací reálný seznam (CARD_CZ_COMGATE „Platební karta“, …) — brána nakonfigurovaná (test mode dle FINISHINGTODOLIST §5).
- **Demo apparel:** `/store/products` vrací 86 produktů včetně `t-shirt`, `sweatpants`, `sweatshirt`, `shorts` (Medusa seed) — pořád v prodejním kanálu.
- **DPH konzistence:** košík má `tax_total: 0` (240 Kč item, žádná daň) — backend počítá bez DPH, storefrontové „včetně DPH“ texty jsou tedy fakticky nepravdivé (viz D3).
- **Packaging:** `metadata` produktů je veřejně čitelná přes `fields=metadata`; `packaging_price` nemá nastavený ŽÁDNÝ z 86 produktů (viděné klíče: `clearance` 4×, `cod_allowed` 1×). Min–max rozsah balného by dnes byl prázdný.
- **Storefront staging URL:** není v `.env.local` (`NEXT_PUBLIC_BASE_URL=http://localhost:8000`) — front-end runtime **UNVERIFIED**.

---

## 5. Implementation answers (D)

### D1 — Dynamická doprava-a-platba
**Může storefront číst shipping options bez košíku? NE.** Jediné helpery jsou `listCartShippingMethods(cartId)` (`src/lib/data/fulfillment.ts:7-38`) a `calculatePriceForShippingOption(optionId, cartId)` (:40-73) — obě vyžadují cart; Medusa v2 `GET /store/shipping-options` bez `cart_id` nefunguje a žádná custom store route pro options v backendu není (`../backend/src/api/store/` — pouze carts/comgate/customers/…). Runtime navíc ukazuje, že i s košíkem je seznam dnes prázdný (sekce 4).

**Packaging costs: ANO, už dnes viditelné.** Klíč je `product.metadata.packaging_price` (number, CZK) — potvrzeno v `../backend/src/api/admin/workbench/products/route.ts:222-224`, `.../flags/route.ts:45` a `../backend/src/modules/ceskaPostaFulfillment/service.ts:252-269` (kalkulovaná cena = base carriage per service code + Σ packaging_price položek; fallback `default_packaging_price_czk`). Store API metadata vrací (runtime ověřeno), takže min–max rozsah lze spočítat storefrontem: `listProducts({queryParams:{fields:"id,metadata", limit:100}})` → min/max `metadata.packaging_price`. Pozor: dnes není vyplněná ani jedna hodnota.

**Co chybí a co má backend přidat:** ceny options bez košíku. Base carriage per service code žije jen v module options provideru (`ceskaPostaFulfillment/service.ts:70-77` `base_price_czk`), store-side neviditelné; flat options zase potřebují cart na listing. **Doporučení: backend přidá `GET /store/shipping-catalog`** (veřejná, cacheovatelná ~1 h) vracející `[{ id, name, price_type, amount (flat) | base_amount (calculated, bez balného), service_code, fulfillment_type, currency_code }]` — čerpá ze shipping options konfigurace + provider options; stejný požadavek položit v backend reportu (mají tam tutéž otázku). Alternativa bez zásahu do backendu — server-side jednorázový košík na warm cache — funguje, ale u calculated options vrací carriage+balné dohromady pro obsah syntetického košíku, takže „cena služby + rozsah balného“ z ní čistě nesloží; nedoporučuji.

**Rendering plán:** server component v `doprava-a-platba/page.tsx` — nový helper `src/lib/data/shipping-catalog.ts` (nový soubor, kvůli paralelnímu workstreamu nesahat do `fulfillment.ts`), `next: { revalidate: 3600 }`; render „Název — cena X Kč · balné Y–Z Kč podle výrobku“ pro CZ/SK zvlášť podle currency_code; prázdný seznam → poctivá věta „Dopravu právě přenastavujeme…“ místo prázdné sekce; statické zůstávají jen ComGate popisy a QR/převod bloky (merchant.ts). Smazat všech 7 duplicitních cenových sekcí (D3 zároveň řeší „včetně DPH“).

### D2 — Kurzy inquiry form
**Dnešní cesta:** `/kurzy` → `src/modules/home/Kurzy/Intro/index.tsx:529-533` („Kurz pro školu“) a :603-607 („Dejte mi vědět“) → `ContactTrigger topic="Kurzy"` (`ContactDialog/trigger.tsx:16,29`) → `ContactDialogPanel`. Formulář (jméno, e-mail, telefon volitelně, zpráva + honeypot `website`) POSTuje na `${BACKEND}/store/contact` (`panel.tsx:55-56, 140-151`), **gated** `NEXT_PUBLIC_CONTACT_FORM_ENABLED === "true"` (`panel.tsx:53`) — flag není v `.env.local` a **backend route `/store/contact` neexistuje** (`../backend/src/api/store/`: žádný adresář contact). Dnes tedy dialog ukazuje jen přímé kontakty (záměrný fallback, „a dead form must never ship“ :49-52).

**Plán:** (1) backend přidá `POST /store/contact` (rate-limit + honeypot check + notifikace) — už referencované jako „D-S1“; (2) flag zapnout v Railway; (3) na `/kurzy` embedovat formulář jméno/telefon/e-mail/zpráva — extrahovat formovou část `panel.tsx` (submit :126-162 + pole) do sdíleného `ContactForm` komponentu ve vizuálním jazyce webu, s `topic` fixně „Kurzy“ (a telefon povinný — dnes optional `panel.tsx:135,146`); dialog i embedded forma pak sdílí jeden submit. Spam: stávající honeypot `website` (:149) + server-side rate limit v nové route; CAPTCHA není třeba.

### D3 — DPH sweep (Lucia NENÍ plátce)
Zákaznicky viditelné výskyty (12):
1. `smluvni-podminky/data.ts:32` — „Ceny zboží jsou uvedeny včetně daně z přidané hodnoty…“
2. `smluvni-podminky/page.tsx:52` — „Prodávající je plátcem daně z přidané hodnoty.“ (přímo nepravdivé)
3.–9. `doprava-a-platba/page.tsx:31, 39, 54, 62, 70, 165, 173` — „cena služby je … včetně DPH“ (7×)
10. `src/modules/layout/components/cart-dropdown/index.tsx:224` — „včetně DPH“
11. `src/modules/checkout/components/review/recap.tsx:91` — „Včetně DPH {money(cart?.tax_total)}. Tolik zaplatíte.“ (renderuje i částku daně — runtime `tax_total: 0`, ukázalo by „Včetně DPH 0,-“)
12. `src/modules/common/components/cart-totals/index.tsx:87` — „Celkem *včetně DPH*“

Kódové/interní (přejmenovat při zásahu): `recap.tsx:8` (komentář „total including VAT“), `review/style.module.scss:170` `.vatNote`, `cart-totals/style.module.scss:255-256` (komentář + `.vatNote`).

Příbuzné formulace „daňový doklad“ (neplátce vystavuje fakturu, ne daňový doklad): `smluvni-podminky/page.tsx:51-52`, `odstoupeni-od-smlouvy/page.tsx:45` a :64. E-maily renderované storefrontem ani order šablony DPH nezmiňují (grep `src/`: žádné další).

### D4 — Express checkout, úplný stav
**Flow:** `/express-checkout/[handle]` (`page.tsx:16-70`) → `Router` (`Router/index.tsx:61-77` krokování přes `?step=`) → 01 Výběr (`Product` → `selectExpressVariant/Bundle`, vlastní košík pod `_medusa_express_cart_id` cookie, `express-cart.ts:29-66,78-138`) → 02 Doručení (`Shipping` — adresa + doprava + kalkulované ceny, `Shipping/index.tsx:65-97`) → 03 Platba (`Payment`).

**ComGate-only kusy:** celý krok 03 — `pay()` odmítne ne-ComGate option (`Payment/index.tsx:74`), session natvrdo `pp_comgate_comgate` (:85), prázdné brány = slepá ulička (:207-211). Osobní odběr/dobírka v expressu neexistují.

**Dokončitelnost:** objednávka se reálně dokončí, ale nechtěnou cestou — brána vrací na `/{cc}/cart/{cartId}/confirmed|canceled|pending` (backend fallback, `return_path` ignorován — detail N-03), kde `PaymentConfirmed` zavolá `placeOrder(cartId)`. Vedlejší škody: smazaná cookie hlavního košíku, nesmazaná express cookie, mrtvé `/express-checkout/result/*` + `/confirmation/*` + `completeExpressCart`. Fix: backend číst `return_path`/`url_*` z session dat, NEBO storefront posílat `url_paid: /{cc}/express-checkout/confirmation/{cartId}` atd.; `placeOrder` mazat main-cart cookie jen když `cartId === getCartId()`.

**Kam patří souhlas:** do kroku 03 nad `ComgatePaymentSelector` — checkbox stejného vzoru jako `review/index.tsx:201-224` (sdílet komponentu), zápis `terms_accepted_at/terms_version` přes `setExpressCartMetadata` PŘED `initiatePaymentSession` (analogicky `review/index.tsx:82-101`); disable confirm dokud není zaškrtnuto; věta :202-205 pak může zůstat jako doplněk s odkazy na podmínky.

### D5 — Search/filter bug („filtering subgroups“)
**Root cause (dvě spolupůsobící příčiny v dotazu, ne v UI):**
1. Výběr subkategorie ve FilterPanelu posílá **kolekci i kategorii zároveň** — `FilterPanel/index.tsx:149-158` nastaví `{collectionId, categoryId}` a `listStoreCatalogue` z toho udělá `category_id=[…] AND collection_id=[…]` na `/store/products` (`src/lib/data/products.ts:177-183`). Medusa obě podmínky ANDuje na produktu: každý produkt, který je v kategorii, ale nemá `collection_id` té kolekce, zmizí. Kategorie se přitom pod kolekci dostane i pouhým `metadata.collection_id` propojením bez jediného společného produktu (`store/page.tsx:59-63`) — pak je průnik garantovaně prázdný grid.
2. `category_id` filtr Medusy matchuje **jen přímé přiřazení, ne potomky** — parent kategorie („skupina“) nevrátí produkty zařazené pouze do subkategorií. Storefront nikde descendant-expanzi nedělá (`products.ts:177-179` posílá jediné id; `listCategories` v `store/page.tsx:40-43` ani nenačítá `parent_category_id`).

**Fix bez re-diagnózy:** při volbě kategorie posílat JEN `category_id` (kolekci nechat jako UI stav rozbalení, ne jako filtr — `FilterPanel/index.tsx:153-157` vypustit `collectionId` z patche), a v `listStoreCatalogue` expandovat zvolenou kategorii na `[id, ...descendant ids]` (strom přes `listCategories` s `parent_category_id`/`include_descendants_tree`, cacheovat). Bonus stejného zásahu: fallback seznam kategorií filtrovat přes `SEED_CATEGORY_HANDLES` (N-09).

### D6 — Account mockup data
Mockupy jsou už jen v `src/modules/account/preview-data.ts` a VŠECHNY spotřebiče je mají zakomentované: wishlist (`wishlist/page.tsx:126-133` → reálný `/store/customers/me/wishlists`, endpoint existuje `../backend/src/api/store/customers/me/wishlists/route.ts`), reviews (`reviews/page.tsx:138-145` → `/store/customers/me/reviews`, existuje), product-reviews na PDP (reálná data, endpoint `/store/products/[id]/reviews` existuje). Dashboard overview čte reálné customer+orders (`@dashboard/page.tsx:14-26`). Backend endpointy dalších flowů: restock `/store/restock-subscriptions` ✓, newsletter `/store/newsletter` ✓, variants price ✓, cart metadata ✓; price-watch existuje jen backend-side (`../backend/src/modules/price-watch/`, job `watch-price-drops.ts`) — storefront žádné price-watch UI nemá. **Zbývající nepravdivé chování:** (1) `profile-email` — falešný success; správný helper `updateCustomer` z `@lib/data/customer` (dnes zakomentovaný, `profile-email/index.tsx:9,29`), případně pole zamknout s vysvětlením; (2) reviews obohacení jen 16 produkty (N-11) — dotáhnout produkt per review přes `retrieveProduct(review.product_id, {fields:"id,handle,thumbnail,title"})` jako wishlist (`wishlist/page.tsx:108-118`); (3) smazat mrtvý `DebugReviewsLogger.tsx`; `preview-data.ts` nechat/odstranit vědomě.

---

## 6. Suggested split — 2 paralelní workstreamy bez konfliktů

**WS-A · „Obsah, právo, SEO“** (texty a statické stránky; žádné zásahy do checkout logiky)
- Vlastní: `(main)/smluvni-podminky/**`, `ochrana-osobnich-udaju/**`, `cookies/**`, `odstoupeni-od-smlouvy/**`, `doprava-a-platba/**` (dynamický blok + D3), `reklamacni-protokol/**`, `src/modules/legal/**`, `src/modules/order/components/carrier-damage/*` (jen texty/odkaz na PDF), `src/lib/data/merchant.ts` (číslo účtu po rozhodnutí), **nový** `src/lib/data/shipping-catalog.ts` (D1), `src/modules/layout/Footer/*` (newsletter souhlas), `src/modules/layout/CookieNotice/*` + sladění s cookies stránkou, `src/modules/layout/ContactDialog/**` + `src/modules/home/Kurzy/**` (D2), DPH textace v `src/modules/common/components/cart-totals/*`, `src/modules/layout/components/cart-dropdown/index.tsx` (:224) a `src/modules/checkout/components/review/recap.tsx` (POZOR: jen recap.tsx, index.tsx patří WS-B), SEO: `src/app/robots.ts` + `sitemap.ts` (nové), smazání `next-sitemap.js`, OG/twitter obrázky, favicon, metadata legal stránek, staging noindex.
- Závislosti na backendu: `/store/shipping-catalog` (D1), `/store/contact` (D2) — stránky psát tak, aby do té doby degradovaly poctivě.

**WS-B · „Checkout, robustnost, data“** (logika; žádné zásahy do legal textů)
- Vlastní: `src/modules/checkout/**` kromě `review/recap.tsx` (N-01 payment-button, N-04, N-05 konsent zápis, shipping cleanup N-12/14/15), `src/modules/express-checkout/**` + `(express-checkout)/**` (N-03, D4 konsent, `100dv`), `src/lib/data/cart.ts`, `express-cart.ts`, `fulfillment.ts`, `payment.ts`, `products.ts` (N-06, D5), `src/modules/store/Shop/**` (D5, N-09), `src/modules/layout/Navbar/**` (navbarSearch), `src/middleware.ts` (N-07), `src/app/**` error boundary soubory (nové `error.tsx`/`global-error.tsx`), `(main)/page.tsx`, `kurzy/page.tsx`, `o-mne/page.tsx` (return-null + Sanity catch — pozor: jen fetch logika; kurzy CTA/obsah je WS-A), `src/sanity/env.ts`, account moduly (`profile-email`, reviews/wishlist pages, DebugReviewsLogger), `src/app/api/**`, `next.config.js`, `check-env-variables.js`, `.env.local.template`, console sweep, `src/lib/util/money.ts` (N-10), `src/lib/constants.tsx` (N-18).
- Závislosti na backendu: shipping options konfigurace (N-02), ComGate `return_path`/`url_*` (N-03), verdikt nad `/store/payment/capture` (N-08).

Jediné sdílené soubory jsou vyřešené explicitním dělením výše (`review/recap.tsx` vs. `review/index.tsx`; `kurzy` obsah vs. fetch; nový `shipping-catalog.ts` místo `fulfillment.ts`). Merge pořadí je pak libovolné.
