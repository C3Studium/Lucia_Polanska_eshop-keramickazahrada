# Sledování zásilek ČP, automatické „předáno dopravci" a recenze na Google

Kontrakt pro implementaci (9. 10. 2026). Jediný zdroj pravdy pro agenty — backend
(modul, job, API, e-maily) a admin widget se staví proti němu.

## 0. Proč

Dnes se „Odesláno" zapíná ručně („Označit jako odeslané" → fáze `shipped` →
e-mail `order-shipment`). Majitelka chce, aby se zákazníkovi poslalo „objednávka
předána dopravci" **ve chvíli, kdy dopravce balík skutečně převezme**, a aby
backend dál věděl, co se se zásilkou děje (na cestě → uloženo → převzato). Pro
zákazníka komunikace z naší strany **končí předáním** — další e-mail je až
prosba o recenzi **týden po převzetí**, směrovaná na Google recenze.

Vedlejší nález, který tohle opravuje mimochodem: lehké „Označit jako odeslané"
(commit 728ce57) **neplní `fulfillment.shipped_at`** (to dělá jen
`createOrderShipmentWorkflow` v ship-merchant-order / handover / pickup). Na
`shipped_at` ale visí job `request-reviews` i 14denní lhůta odstoupení
(`lib/claims/context.ts`). Převzetí dopravcem je přesně ten okamžik, kdy má
shipment vzniknout → tracking ho založí.

## 1. Zdroj dat

Veřejný JSON ČP, bez autentizace (ověřeno živě 9. 10. 2026):

```
GET https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson?idParcel=<parcel_code>
→ [{ id, attributes: {...}, states: { state: [ { id, date: "YYYY-MM-DD", text, postcode, postoffice, ... } ] } }]
```

Neznámé číslo vrací jeden stav `id: "-3"` („Zásilka tohoto podacího čísla není
v evidenci."). Časové razítko události je jen datum; pořadí v poli = chronologie.
Volat max. 1× za 30 min na zásilku, User-Agent `KeramickaZahrada/1.0`.

nAPI B2B má `parcelStatus` (až 10 zásilek na dotaz), ale vyžaduje ostrý účet a
testovací zásilky ve sledování neexistují → **nepoužívat**; testuje se simulací
(§5).

### Číselník stavů (contributte/czech-post `HistoryState`, ověřeno)

| id | text ČP | naše fáze |
|---|---|---|
| `-M` | Obdrženy údaje k zásilce | `label` (jen data = náš štítek) |
| `21` | Podaná zásilka | **`handed_over`** → spouští „předáno dopravci" |
| `75` | Přepravovaná zásilka | `in_transit` |
| `51` | Vstup na dodací poštu | `in_transit` |
| `8D` | Dosílka na jinou adresu | `in_transit` |
| `8T` | Chybně směrovaná | `in_transit` (+ poznámka) |
| `82` | Uložená | `stored` (Balíkovna / pošta — čeká na vyzvednutí) |
| `91` | Doručená | **`delivered`** (hotovo) |
| `95` | Vrácená | `returned` (hotovo, upozornit majitelku) |
| `9V` | Doručená odesílateli | `returned` (hotovo) |
| `8E` | Poškozená | `problem` (upozornit majitelku, sledovat dál) |
| `88` | Vyšlá z evidence | hotovo bez změny fáze |
| `-3`, `-4` | není v evidenci / nezobrazuje se | `label` (čekat; po 30 dnech od štítku vzdát) |

Neznámé id → klasifikace podle textu (klíčová slova: „podán"/„převzat" →
handed_over, „doruč"/„dodán" → delivered, „ulož" → stored, „vrác" → returned,
jinak `in_transit`), vždy se uloží syrová událost.

## 2. Datový model — modul `parcel-tracking`

`backend/src/modules/parcel-tracking` (DML + ruční migrace jako u
`return-request`), model `parcel_tracking`:

| pole | typ | poznámka |
|---|---|---|
| `id` | text PK | |
| `order_id` | text, unique | jedna zásilka na objednávku (rozdělené zásilky neřešíme) |
| `carrier` | text | `"ceska-posta"` |
| `parcel_code` | text | z `order.metadata.cp_label_tracking` |
| `service_code` | text null | `NB` / `DR` z metadat / fulfillmentu |
| `phase` | text | `label` · `handed_over` · `in_transit` · `stored` · `delivered` · `returned` · `problem` (CHECK) |
| `events` | jsonb | `[{ id, text, date, postoffice?, postcode?, source: "cp" \| "simulated", seen_at }]` — append-only, dedupe podle `id+date+text` |
| `handed_over_at` | timestamptz null | první `21` |
| `stored_at` | timestamptz null | první `82` |
| `delivered_at` | timestamptz null | `91` |
| `returned_at` | timestamptz null | `95`/`9V` |
| `last_state_id` / `last_state_text` | text null | poslední událost |
| `last_checked_at` | timestamptz null | |
| `check_count` | int default 0 | |
| `done` | boolean default false | už se nedotazovat (delivered/returned/88/vzdáno) |
| `note` | text null | třeba „vzdáno po 30 dnech" |
| `created_at` / `updated_at` | | |

## 3. Reakce na události — `lib/parcel-tracking/apply.ts`

`applyParcelEvents(container, tracking, events, source)` — jedna cesta pro job
i simulaci, idempotentní (razítka `*_at` se nastaví jen jednou, přechody fáze
jen vpřed; `problem` neposouvá zpět).

| událost | co se stane |
|---|---|
| první `21` | `handed_over_at`, fáze `handed_over`. Pak: (a) **shipment** — pro nezrušený fulfillment objednávky bez `shipped_at` spustit `createOrderShipmentWorkflow` (jako v `confirm-merchant-handover.ts`; nastaví `shipped_at`); (b) **fáze** — je-li merchant fáze ∈ {received, working, shipping}: ship gate (`loadShipGateInput`/`evaluateShipGate`); projde → `transitionMerchantOrderWorkflow` na `shipped` (`reconcile: true`) → stávající `onMerchantStageChanged` pošle `order-shipment`; neprojde → `notifyMerchant` owner (email) „ČP převzala zásilku, ale objednávka není zaplacená" a fázi neměnit. Fáze už `shipped` → jen razítko. |
| `75`/`51`/`8D`/`8T` | fáze `in_transit` (jen z `handed_over`). Bez e-mailu. |
| `82` | `stored_at`, fáze `stored`. Bez e-mailu (ČP posílá vlastní výzvu). |
| `91` | `delivered_at`, fáze `delivered`, `done`. **Bez e-mailu zákazníkovi** (přání majitelky: komunikace končí předáním). Zůstává jediný následný krok: recenze (§6). |
| `95`/`9V` | `returned_at`, fáze `returned`, `done`, `notifyMerchant` owner (email) „Zásilka #N se vrací / vrátila". |
| `8E` | fáze `problem`, `notifyMerchant` owner (email) „ČP hlásí poškození zásilky #N". Sledovat dál. |
| `88` | `done`, bez změny fáze. |
| `-3`/`-4` | nic; `check_count`++; po 30 dnech od `created_at` → `done`, `note`, `notifyMerchant` owner „zásilka se u ČP neobjevila" (štítek vytištěn, balík neodešel?). |

E-mail `order-shipment` (handler `onMerchantStageChanged`, stage `shipped`):
doplnit `trackingLink` = `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=<cp_label_tracking>` (jen když číslo je) a `carrierName`
= `Česká pošta – Balíkovna` pro `NB`, `Česká pošta` pro `DR`, jinak název metody.

## 4. Kdy vzniká záznam

- **Automaticky** po úspěšném vygenerování štítku (`POST /admin/merchant-orders/:orderId/label`,
  kde se razítkuje `cp_label_tracking`): upsert `parcel_tracking` {order_id,
  parcel_code, service_code, phase `label`}. Testovací generování (`?test=1`)
  záznam **také** založí (ať jde simulace vyzkoušet), s `note: "test label"`.
- **Ručně** z widgetu („Začít sledovat") pro starší objednávky s číslem zásilky
  v metadatech, ale bez záznamu.
- Osobní odběr a objednávky bez čísla zásilky se nesledují.

## 5. Job + API

**Job `backend/src/jobs/watch-parcel-tracking.ts`** — `*/30 * * * *`: řádky
`done = false` s `parcel_code`, max 50 za běh, seřazené podle
`last_checked_at` (nejstarší první). Pro každý: dotaz ČP (timeout 10 s, chyba
sítě → jen log a `last_checked_at`), `applyParcelEvents`. Log souhrn.

**Admin API** (`backend/src/api/admin/merchant-orders/[orderId]/tracking/route.ts`):

- `GET` → `{ tracking: ParcelTracking | null, parcel_code: string | null (z metadat, i bez záznamu), tracking_url: string | null, simulate_allowed: boolean, carrier_label: string }`
- `POST { action: "start" }` → založí záznam z metadat (400 bez čísla zásilky).
- `POST { action: "refresh" }` → okamžitý dotaz ČP + apply; vrací jako GET.
- `POST { action: "simulate", state: "21" | "75" | "82" | "91" | "95" | "8E" }` → jen když
  `simulate_allowed`; přidá syntetickou událost `{ id: state, text: "<text z číselníku> (simulace)", date: dnes, source: "simulated" }` a projde `applyParcelEvents` — **stejná cesta jako job**, tedy i e-mail „předáno dopravci", shipment a fáze. 403 jinak.

`simulate_allowed` = `process.env.CP_TRACKING_SIMULATE === "1"` **nebo**
`BALIKOVNA_API_URL` obsahuje `b2b-test`. (Na ostro s ostrou URL se simulace
schová, pokud ji env výslovně nezapne.)

## 6. Recenze na Google

**Job `request-reviews.ts`** přepracovat:

- Okamžik „převzato" = `parcel_tracking.delivered_at` (sledované zásilky), u
  osobního odběru `fulfillment.shipped_at` (vyzvednutí, `complete-personal-pickup`),
  u nesledovaných zásilek dnešní fallback `fulfillment.shipped_at` + 3 dny navíc.
- Odeslat `review_request_days` dnů poté (default změnit **10 → 7**; nastavení
  zůstává), okno 30 dnů, dedupe `review-request:${order.id}` beze změny, nikdy
  u zrušené objednávky ani u objednávky s otevřenou/zamítnutou reklamací
  (`return_request` v jiném stavu než žádný/`resolved`… konkrétně: existuje-li
  žádost ve stavu `pending`/`approved`/`received` → odložit; `rejected`/`cancelled`/`resolved` s refundací → neposílat).

**E-mail `order-review.tsx`:** hlavní tlačítko **„Napsat recenzi na Google"**
→ `reviewUrl`:
1. `GOOGLE_REVIEW_URL` (celá URL, má přednost), jinak
2. `GOOGLE_PLACE_ID` → `https://search.google.com/local/writereview?placeid=<id>`
   (otevře přímo Googlí dialog pro napsání recenze — nejbližší „widget", který
   v e-mailu existuje; e-mailové klienty skripty nespouští, interaktivní widget
   do e-mailu vložit nejde), jinak
3. dnešní odkaz na hodnocení produktu na webu.
Druhé tlačítko (ghost) „Ohodnotit na našem webu" (produkt `#hodnoceni`), když
je k dispozici a liší se. Text: „kousek je u vás už týden…". Helper
`lib/google-review-url.ts` (`googleReviewUrl(): string | null`), env zapsat do
`docs/env-inventory.md`.

## 7. Admin widget

`backend/src/admin/widgets/cp-tracking.tsx`, zone `order.details.side.after`
(pod štítkem; vzor `cp-label.tsx`: QueryClientProvider, `sdk.client.fetch`,
skrýt u osobního odběru / mimo ČP). Obsah:

- Nadpis „Zásilka u České pošty", badge fáze (grey label · blue handed_over ·
  blue in_transit · orange stored · green delivered · red returned/problem).
- Stepper 5 kroků: Štítek → Předáno dopravci → Na cestě → Uloženo k vyzvednutí
  → Převzato zákazníkem (hotové = plné, aktuální = zvýrazněné; returned/problem
  jako červený řádek pod stepperem s textem ČP). U každého kroku datum z `*_at`.
- Poslední stav ČP (text + datum), číslo zásilky, odkaz „Sledovat u ČP"
  (`tracking_url`), „naposledy zkontrolováno".
- Tlačítka: „Zkontrolovat teď" (refresh); „Začít sledovat" (jen když
  `parcel_code` je a `tracking` null); při `simulate_allowed` sekce
  „Simulace (testovací prostředí)" s tlačítky Předáno dopravci · Na cestě ·
  Uloženo · Doručeno · Vráceno · Poškozeno + věta, že simulace projde stejnou
  cestou jako ostrý stav (odejde e-mail zákazníkovi, změní se fáze).
- Bez záznamu a bez čísla zásilky: „Sledování začne po vygenerování štítku."

Query keys: `["cp-tracking", order.id]`; po akci invalidovat i
`["cp-label", order.id]` a `["merchant-order", order.id]` (existují-li).

## 8. Mimo rozsah

Storefront (zákazník nic nového nevidí — končí e-mailem „předáno dopravci" s
odkazem na sledování), jiní dopravci, rozdělené zásilky, nAPI `parcelStatus`.
