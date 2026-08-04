# Denní práce — architektonický audit

**Rozsah:** `backend/` proti nativní Medusa **2.18.0**
**Datum:** 2026-08-04
**Stav:** návrh k odsouhlasení — *žádný kód nebyl změněn*

Všechna tvrzení níže jsou ověřena proti zdrojovému kódu v `backend/node_modules/@medusajs/*`
(verze 2.18.0) a proti oficiální dokumentaci. Kde je závěr odvozen ze zdrojáku, je uveden
konkrétní soubor a řádek, aby se dal kdykoli přeověřit.

---

## 1. Architektura

### 1.1 Co je nativní a co je vlastní

Instalace vychází z „medusa-2.0-boilerplate-backend" a je proti čisté Medusa instalaci
rozšířena o 13 vlastních modulů, 21 module linků, ~40 workflows, 7 admin routes a 6 widgetů.

| Vrstva | Nativní Medusa 2.18 | Vlastní v tomto projektu |
| --- | --- | --- |
| Commerce moduly | order, cart, payment, fulfillment, product, pricing, inventory… | — |
| Payment provider | `@medusajs/payment-stripe` | `comgate` |
| Fulfillment provider | `fulfillment-manual` | `ceskaPostaFulfillment`, `zasilkovnaFulfillment` (`packeta`) |
| File | `file-local` | `minio-file` |
| Notification | `notification-sendgrid` | `resend` |
| Analytics | `@medusajs/medusa/analytics` | `segment` |
| Doménové | — | `merchant-order`, `merchant-catalog`, `made-to-order`, `bundled-product`, `product-review`, `restock`, `wishlist`, `sanity` |

### 1.2 Pět auditovaných modulů

#### `merchant-order` — „Denní práce"

Nejmenší modul v projektu. Jediný model:

[merchant-order-state.ts](backend/src/modules/merchant-order/models/merchant-order-state.ts)

```
merchant_order_state
  order_id  (unique)
  stage     enum: received | working | shipping | shipped | payment_problem | cancelled
  requires_attention, attention_reason
  stage_changed_at, stage_changed_by, internal_note
```

Napojení na Medusa: read-only link
[merchant-order-state-order.ts](backend/src/links/merchant-order-state-order.ts) →
`merchantOrderState.order_id` ⇒ `order`.

Tok:

```
order.placed ──▶ initialize-merchant-order (subscriber)  ──▶ vytvoří state "received"
                                                          └─▶ vytvoří production_order (pokud MTO)

Admin UI  ──▶ PATCH /admin/merchant-orders/:orderId
              └─▶ transitionMerchantOrderWorkflow
                    ├── acquireLockStep
                    ├── updateMerchantOrderStateStep   (jediný reálný krok)
                    ├── emitEventStep "merchant-order.stage-changed"   ← nikdo neposlouchá
                    └── releaseLockStep
```

#### `merchant-catalog`

Merchandising nad nativními `product_collection` / `product_category`:
`collection_profile` (obrázky, SEO, pořadí, viditelnost), `collection_category_assignment`,
`seasonal_selection` + `seasonal_selection_item`. Workflows
[manage-merchant-collection.ts](backend/src/workflows/manage-merchant-collection.ts) a
[manage-seasonal-selection.ts](backend/src/workflows/manage-seasonal-selection.ts) volají
nativní `createProductsWorkflow` / `createRemoteLinkStep`. **Toto je správně navržená
aditivní nadstavba** — nenahrazuje nativní kolekce, jen k nim přidává data.

#### `seasonal-selection`

Není samostatný modul — je to `seasonal_selection` + `seasonal_selection_item` uvnitř
`merchant-catalog`, s linkem na nativní `price_list`
([seasonal-selection-price-list.ts](backend/src/links/seasonal-selection-price-list.ts)).
Slevy tedy řeší nativní Price Lists. Správně.

#### `made-to-order`

Nejsložitější modul. `product_production_profile`, `variant_production_profile`,
`production_order`, `production_payment_request`. Lifecycle
`specification_pending → confirmed → in_production → awaiting_balance → ready_to_ship → completed`.

Pozitivní zjištění: [actions/route.ts](backend/src/api/admin/made-to-order/orders/[orderId]/actions/route.ts)
používá **nativní workflows** pro všechny peněžní operace —
`beginOrderEditOrderWorkflow`, `orderEditUpdateItemQuantityWorkflow`,
`requestOrderEditRequestWorkflow`, `confirmOrderEditRequestWorkflow`,
`createOrderPaymentCollectionWorkflow`, `createPaymentSessionsWorkflow`. Cena objednávky
se tedy nemění zápisem do DB, ale přes Order Edit. **Toto je vzor, který by měl platit
i pro Denní práci.**

#### `bundled-product`

`bundle` + `bundle_item`, linky na nativní produkt/variantu. Workflows staví na
`createProductsWorkflow`, `addToCartWorkflow`, `deleteLineItemsWorkflow`. Aditivní, v pořádku.

### 1.3 Jak se stavy skládají dnes

Objednávka má dnes **tři nezávislé stavové stroje**, které spolu nekomunikují:

```
 nativní Medusa            merchant-order            made-to-order
 ──────────────            ──────────────            ─────────────
 order.status              stage                     stage
 payment_status  ◀── ✗ ──▶ received/working/... ◀─┬─▶ specification_pending/…
 fulfillment_status         (ruční tlačítka)      │   (ruční tlačítka)
                                                  │
                          setMerchantStage() ─────┘  (jednosměrně, jen MTO → merchant)
```

Nativní stav a `merchant_order_state` se nikdy nesynchronizují zpět. To je kořen bodu
„Merchant state a native fulfilment state diverge".

---

## 2. Aktuální problémy

### 2.1 Chybné částky (Denní práce zobrazuje jiný total než detail objednávky)

**Root cause: neúplná projekce položek v ručně psaném `query.graph`.**

[route.ts:24-46](backend/src/api/admin/merchant-orders/route.ts#L24-L46) žádá:

```ts
fields: ["id","display_id","created_at","email","currency_code","total",
         "payment_status","fulfillment_status",
         "items.id","items.title","items.quantity","items.thumbnail",
         "items.variant_title","items.metadata","shipping_methods.*"]
```

`order.total` **není sloupec v DB** — je to dopočítávaná hodnota. Order modul ji spočítá
jen tehdy, když je `total` v `select`, a tehdy si do `relations` přidá
`items.tax_lines`, `items.adjustments`, `shipping_methods.tax_lines`, `credit_lines`
(`order-module-service.js:154-208`). Výpočet pak provede `decorateCartTotals()`, který
v `getLineItemsTotals` počítá `MathBN.mult(item.unit_price, item.quantity)`
(`@medusajs/utils/dist/totals/line-item/index.js:49`).

Jenže `unit_price` **není v projekci**. MikroORM při explicitním `fields` vybírá jen
uvedené sloupce (`AbstractSqlDriver.js:1300-1330`), takže `unit_price` se nenačte
a součin je nula/NaN.

Že jde přesně o tuto past, potvrzuje nativní implementace: `getOrdersListWorkflow`
si do fields **vynuceně** přidá `"items.*"` — právě proto, aby dopočet totálů fungoval
(`@medusajs/core-flows/dist/order/workflows/get-orders-list.js:50-64`).

### 2.2 `payment_status` a `fulfillment_status` jsou vždy prázdné

**Root cause: tato pole na entitě `order` v Query vůbec neexistují.**

Ověřeno třemi nezávislými způsoby:

1. DML model `Order` je nemá (`@medusajs/order/dist/models/order.js` — pouze `id`,
   `display_id`, `status`, `email`, `currency_code`, `summary`, `items`, … ).
2. GraphQL schema Order modulu je má pouze na typu `OrderDetail` (řádek 627),
   nikoli na typu `Order` (řádky 274-345, kde jsou jen totály)
   (`@medusajs/order/dist/schema/index.js`).
3. Tabulka `"order"` je nemá — migrace `Migration20240219102530` je vytváří bez nich.

Ve skutečnosti je Medusa **dopočítává v aplikačním kódu**, funkcemi
`getLastPaymentStatus()` / `getLastFulfillmentStatus()`
(`@medusajs/core-flows/dist/order/utils/aggregate-status.js`), a to výhradně uvnitř
`getOrdersListWorkflow` a `getOrderDetailWorkflow`.

Proč to nespadne s chybou: MikroORM neznámé pole v `fields` **tiše zahodí** —
`processField()` má na prvním řádku `if (!prop) return;`
(`@mikro-orm/knex/AbstractSqlDriver.js:1277-1280`). Endpoint tedy vrátí 200,
jen bez těch dvou klíčů.

Důsledek v UI: [page.tsx:215](backend/src/admin/routes/merchant-orders/page.tsx#L215)
vypisuje `order.payment_status || "Stav platby neznámý"` → **u každé objednávky
vždy „Stav platby neznámý"**, i když ComGate v pořádku zachytil platbu.

Tím je vysvětlen i bod „Payment state appears correct after ComGate capture":
nativně je stav **správně**, jen ho Denní práce neumí přečíst.

### 2.3 „Otevřít objednávku" neotevře nativní stránku přirozeně

[page.tsx:131-138, 219-221](backend/src/admin/routes/merchant-orders/page.tsx#L131-L138)

```ts
const getOrderHref = (orderId: string) => {
  const markerIndex = window.location.pathname.indexOf("/merchant-orders")
  const adminBase = markerIndex >= 0 ? window.location.pathname.slice(0, markerIndex) : "/app"
  return `${adminBase}/orders/${orderId}`
}
…
<Button asChild><a href={getOrderHref(order.order_id)}>Otevřít objednávku</a></Button>
```

Dvě chyby:

* `<a href>` = **plný reload prohlížeče**. Celý admin SPA se odmountuje, znovu se
  bootstrapuje session, znovu se stahují všechny extension bundly. Trvá to sekundy
  a ztratí se stav (filtry, scroll, react-query cache).
* Base path se odvozuje řetězcovým hledáním `/merchant-orders` v URL. Jakmile se cesta
  přejmenuje nebo zanoří, odkaz tiše zamíří jinam.

Nativní řešení je `Link` / `useNavigate` z `react-router-dom`. Admin extensions sdílejí
router instanci s dashboardem — `react-router-dom` je v
[medusa-config.js](backend/medusa-config.js) uveden v `build.rollupOptions.external`,
takže se nebundluje dvakrát. Klientská navigace je tedy okamžitá.

### 2.4 „Odesláno" nespustí nativní fulfilment

**Root cause: v celém `backend/src/` není jediné volání fulfilment workflow.**

Ověřeno `grep` napříč repozitářem — `createOrderFulfillmentWorkflow`,
`createOrderShipmentWorkflow`, `cancelOrderFulfillmentWorkflow`,
`markOrderFulfillmentAsDeliveredWorkflow` a `capturePaymentWorkflow` se **nevyskytují nikde**.

[transition-merchant-order.ts](backend/src/workflows/transition-merchant-order.ts) dělá
pouze `service.updateMerchantOrderStates({ stage: "shipped" })` a vypustí event.
Nativní objednávka zůstane `fulfillment_status: not_fulfilled` navždy.

Přitom Medusa 2.18 má vše připravené:

| Akce | Workflow | Admin API |
| --- | --- | --- |
| Vytvořit fulfilment | `createOrderFulfillmentWorkflow` | `POST /admin/orders/:id/fulfillments` |
| Označit odeslané | `createOrderShipmentWorkflow` | `POST /admin/orders/:id/fulfillments/:fid/shipments` |
| Označit doručené | `markOrderFulfillmentAsDeliveredWorkflow` | `…/mark-as-delivered` |
| Zrušit fulfilment | `cancelOrderFulfillmentWorkflow` | `…/cancel` |
| Zachytit platbu | `capturePaymentWorkflow` | `POST /admin/payments/:id/capture` |

### 2.5 Divergence merchant stavu a nativního stavu

Dva směry, oba rozbité:

* **merchant → native**: „Odesláno" nevytvoří fulfilment (2.4).
* **native → merchant**: když majitelka vytvoří fulfilment na nativní stránce objednávky,
  `merchant_order_state.stage` se nezmění. Není žádný subscriber na
  `shipment.created` / `order.fulfillment_created` — ověřeno v
  [backend/src/subscribers/](backend/src/subscribers/) (existují pouze `order.placed` ×3,
  `customer.created`, `auth.password_reset`, `product.*`, `user invite`).

Navíc `emitEventStep("merchant-order.stage-changed")` v
[transition-merchant-order.ts:98](backend/src/workflows/transition-merchant-order.ts#L98)
vypouští event, který **nikdo neposlouchá** — mrtvý kód.

### 2.6 Chybný link direction

[[orderId]/route.ts:34-36](backend/src/api/admin/merchant-orders/[orderId]/route.ts#L34-L36)
žádá `production_order.*` na entitě `order`.

Read-only linky jsou v Meduse **jednosměrné**. Dokumentace to říká doslova:
*„A read-only module is uni-directional. So, you can only retrieve the linked record
from the first data model."* Potvrzuje to implementace `defineReadOnlyLink()`, která
registruje `extendsConfig` výhradně na `serviceA`
(`@medusajs/utils/dist/modules-sdk/define-link.js:298-336`).

Link je definován jako `productionOrder → order`
([production-order-order.ts](backend/src/links/production-order-order.ts)), takže
dotazovat se lze **jen** `entity: "production_order", fields: ["order.*"]`.
Opačný směr tiše vrací nic.

Stejná chyba se projeví ve výpisu: [page.tsx:271-274](backend/src/admin/routes/merchant-orders/page.tsx#L271-L274)
čte `order?.production_order?.stage`, ale list endpoint `production_order` vůbec
nežádá → **badge „Zakázková výroba" se v Denní práci nikdy nezobrazí**.

### 2.7 Duplikovaná logika

| Duplikát | Nativní ekvivalent |
| --- | --- |
| `formatAmount()` ve 2 souborech, `Intl.NumberFormat` s natvrdo `maximumFractionDigits: 2` | `getStylizedAmount()` / `getLocaleAmount()` (`@medusajs/dashboard/src/lib/money-amount-helpers.ts`) |
| `toNumber()` na BigNumber ve 4 souborech | `MathBN` z `@medusajs/framework/utils` |
| `setMerchantStage()` v [actions/route.ts:60-76](backend/src/api/admin/made-to-order/orders/[orderId]/actions/route.ts#L60-L76) — zapisuje stav mimo workflow, bez zámku i bez validace přechodů | `transitionMerchantOrderWorkflow` |
| Ruční stránkování + `summary` počítané načtením **všech** řádků `listMerchantOrderStates({})` ([route.ts:53](backend/src/api/admin/merchant-orders/route.ts#L53)) | `listAndCount` + agregace v DB |
| Vlastní list-page layout (`<article className="grid …">`) | `DataTable` + `useDataTable` z `@medusajs/ui` (projekt je už používá v [reviews/page.tsx](backend/src/admin/routes/reviews/page.tsx) a [bundled-products/page.tsx](backend/src/admin/routes/bundled-products/page.tsx)) |
| `initialize-merchant-order` subscriber dělá byznys logiku přímo v handleru (bez kompenzace, bez zámku) | workflow + `emitEventStep` |

### 2.8 Drobnosti

* `created_at: record.created_at ?? order?.created_at`
  ([page.tsx:261](backend/src/admin/routes/merchant-orders/page.tsx#L261)) — `record` je
  řádek `merchant_order_state`, takže se zobrazuje **datum vzniku stavu, ne objednávky**.
* Objednávky bez `merchant_order_state` (vzniklé před nasazením modulu, nebo když
  subscriber selhal) se v Denní práci **nikdy neobjeví**.
* `@medusajs/draft-order@2.18.0` je nainstalovaný a sestavený v `node_modules`, ale
  **není zaregistrovaný** — v [medusa-config.js](backend/medusa-config.js) chybí klíč `plugins`.

---

## 3. Doporučená navigace

### 3.1 Otázka 1 — může být „Objednávky" vlastní sekcí?

**Odpověď: částečně. Přesně požadovaný tvar nativně nejde, blízká varianta ano.**

Jádrová položka „Objednávky" je **natvrdo v kódu dashboardu**, ne konfigurovatelná —
`useCoreRoutes()` v `@medusajs/dashboard/src/components/layout/main-layout/main-layout.tsx:184-196`:

```tsx
{
  icon: <ShoppingCart />,
  label: t("orders.domain"),
  to: "/orders",
  items: [
    // TODO: Enable when domin is introduced
    // { label: t("draftOrders.domain"), to: "/draft-orders" },
  ],
},
```

Z toho plyne:

* **Nelze** vytvořit dceřinou položku „Všechny objednávky". Rodičovský `NavLink` **sám**
  míří na `/orders`, tedy *je* seznamem všech objednávek. Extension pointem `nested`
  se dají potomci jen **přidávat**, ne nahradit rodiče.
* **Lze** přidat „Draft Orders" — a to oficiálně podporovanou cestou: plugin
  `@medusajs/draft-order`, který sám deklaruje `nested: "/orders"` (ověřeno v
  `node_modules/@medusajs/draft-order/.medusa/server/src/admin/index.js`). Stačí ho
  zaregistrovat v `medusa-config.js`.

Dosažitelný výsledek:

```
Objednávky            → /orders          (= všechny objednávky)
└ Draft Orders        → /draft-orders    (plugin @medusajs/draft-order)
```

### 3.2 Otázka 2 — může být každá fáze vlastní Admin route?

**Odpověď: ANO — plně a oficiálně podporováno.**

Mechanismus je souborový. `populateMenus()` v
`@medusajs/dashboard/src/dashboard-app/dashboard-app.tsx:163-232` skládá strom podle
cesty: `parentPath = "/" + pathParts.slice(0, -1).join("/")`, a pokud na této cestě
existuje menu item, dítě se vloží do jeho `items[]`. Položky se předtím seřadí
podle délky cesty (`allMenuItems.sort((a, b) => a.path.length - b.path.length)`),
takže rodič je vždy zpracován první. Dokumentace to potvrzuje pro `src/admin/routes/custom/page.tsx`
+ `src/admin/routes/custom/nested/page.tsx`.

Cílová struktura:

```
backend/src/admin/routes/denni-prace/
  page.tsx                  label: "Denní práce"      (bez `nested`!)  → /denni-prace
  nove/page.tsx             label: "Nové"                              → /denni-prace/nove
  pripravujeme/page.tsx     label: "Připravujeme"     rank: 20
  k-odeslani/page.tsx       label: "K odeslání"       rank: 30
  odeslano/page.tsx         label: "Odesláno"         rank: 40
  problem-s-platbou/page.tsx label: "Problém s platbou" rank: 50
```

**Kritické omezení, které dnes blokuje celý požadavek:**

`defineRouteConfig({ nested })` přijímá pouze šest hodnot —
`NESTED_ROUTE_POSITIONS = ["/orders", "/products", "/inventory", "/customers", "/promotions", "/price-lists"]`
(`@medusajs/admin-shared/dist/index.d.ts`). A pokud rodič `nested` má, dashboard
**odmítne všechny jeho potomky**:

```js
// dashboard-app.tsx:196-207
if (parentItem?.nested && NESTED_ROUTE_POSITIONS.includes(parentItem?.nested) && pathParts.length > 1) {
  console.warn(`Nested menu item "${item.path}" can't be added to the sidebar as it is nested under "${parentItem.nested}".`)
  return
}
```

Současná Denní práce **má** `nested: "/orders"`
([page.tsx:352-357](backend/src/admin/routes/merchant-orders/page.tsx#L352-L357)).
Aby mohla mít podpoložky, musí se `nested` **odstranit** a stát se samostatnou
top-level položkou (dashboard ji pak vykreslí ze skupiny `coreExtensions`,
`main-layout.tsx:311, 337-349`).

Cílová postranní lišta:

```
Denní práce                    ← top-level, bez `nested`
├ Nové
├ Připravujeme
├ K odeslání
├ Odesláno
└ Problém s platbou
Objednávky                     ← nativní, /orders
└ Draft Orders                 ← plugin @medusajs/draft-order
Produkty
├ Kolekce / Kategorie / Product options    (nativní)
├ Kolekce a kategorie / Výroba na zakázku / Balíčky / Recenze  (stávající)
Sklad · Zákazníci · Slevy · Ceníky         (nativní)
```

### 3.3 Skrytí složitosti bez psaní kódu

Medusa 2.18 má **layout customization** jako first-class funkci. Postranní lišta,
topbar i detailní stránky jsou hosty `LayoutComposer`
(`main-layout.tsx:316-353`, `customizeId: CUSTOMIZE_IDS.MAIN_SIDEBAR`). V editačním
režimu lze položky **přetahovat a skrývat**, a uložit buď osobně, nebo jako
**systémový default pro všechny uživatele** (`is_default: true`) přes
`POST /admin/layouts/:zone/configuration`
(`@medusajs/medusa/dist/api/admin/layouts/[zone]/configuration/route.js`).

To znamená, že „skrýt Medusa složitost" **není důvod psát vlastní kód** — Ceníky,
Slevy, Kampaně, Sklad se dají klientce skrýt konfiguračně, a Denní práci vytáhnout
nahoru. Totéž platí pro pořadí widgetů na detailu objednávky.

---

## 4. Zlepšení workflow — „jedna objednávka, jedna zřejmá akce"

### 4.1 Návrh cílového toku

Každá fáze = jedna route = jeden seznam = **jedno primární tlačítko na řádek**.

| Route | Kdo tam spadne (odvozeno, ne ručně nastaveno) | Jedna akce | Co se stane nativně |
| --- | --- | --- | --- |
| **Nové** | `payment_status ∈ {captured, authorized}` ∧ `fulfillment_status = not_fulfilled` ∧ stage `received` | „Začít připravovat" | jen `merchant_order_state` (skutečně jen interní stav) |
| **Připravujeme** | stage `working` | „Připraveno k odeslání" | jen `merchant_order_state` |
| **K odeslání** | stage `shipping` | „Vytvořit zásilku a odeslat" | `createOrderFulfillmentWorkflow` → `createOrderShipmentWorkflow`; stage se přepne **až po úspěchu** |
| **Odesláno** | `fulfillment_status ∈ {shipped, delivered}` | „Označit jako doručené" (volitelné) | `markOrderFulfillmentAsDeliveredWorkflow` |
| **Problém s platbou** | `payment_status ∈ {not_paid, awaiting, requires_action, canceled}` ∨ `requires_attention` | „Poslat platební odkaz" | `createOrderPaymentCollectionWorkflow` + `createPaymentSessionsWorkflow` (stejný vzor, jaký už funguje v `made-to-order`) |

Zásadní změna oproti dnešku: **„Problém s platbou" přestává být ručně nastavovaný stav.**
Odvozuje se z nativního `payment_status`, takže se objednávka objeví ve frontě sama —
majitelka nemusí nic rozhodovat.

### 4.2 Redukce kliknutí

| Dnes | Nově |
| --- | --- |
| Denní práce → filtr → „Označit jako odeslané" → *(fulfilment se nestal)* → přepnout na Objednávky → najít objednávku → Fulfill items → vybrat location → Create fulfillment → Create shipment → zadat tracking | „K odeslání" → **„Vytvořit zásilku a odeslat"** (1 klik; location a shipping option se předvyplní z objednávky) |
| Stav platby nezjistitelný z Denní práce → nutné otevřít objednávku | badge se stavem přímo v řádku, korektní |
| Otevření objednávky = plný reload | okamžitá SPA navigace |
| „Problém s platbou" nutno ručně nastavit | fronta se plní sama z `payment_status` |

### 4.3 Kde zůstat u nativního UI

* Detail objednávky **needuplikovat**. Místo toho přidat widget do zóny
  `order.details.side.before` se stavem Denní práce a stejnou jedinou akcí.
  Tím zmizí divergence: stejná akce, stejné workflow, dvě místa.
* Seznamy postavit na `DataTable` + `useDataTable` z `@medusajs/ui` (projekt je už umí),
  případně na `ConfigurableDataTable` z `@medusajs/dashboard/components`, pokud
  klientka ocení ukládané pohledy a konfiguraci sloupců.
* Částky formátovat `getStylizedAmount()` z `@medusajs/dashboard/lib`, ne vlastním `Intl`.

---

## 5. Pořadí implementace

Každý slice je samostatně nasaditelný a samostatně ověřitelný. Po každém slice:
`pnpm typecheck` → `pnpm lint` → backend build → admin build. Bez zeleného výsledku
se nepokračuje.

> **Poznámka k současným skriptům:** `backend/package.json` dnes **nemá** `typecheck`
> ani `lint` skript. Slice 0 je proto musí doplnit (`tsc --noEmit`, resp. eslint),
> jinak nelze požadovaný verifikační cyklus vůbec spustit.

### Slice 0 — příprava (bez funkční změny)

* Doplnit `typecheck` a `lint` skripty do `backend/package.json`.
* Ověřit, že `medusa build` (backend + admin) projde na čistém stromu.
* **Výstup:** zelený baseline.

### Slice 1 — opravit čtení dat (nejvyšší poměr přínos/riziko)

Přepsat [GET /admin/merchant-orders](backend/src/api/admin/merchant-orders/route.ts) tak, aby:

1. z `merchant_order_state` získal jen `order_id` + stage (stránkovaně, `listAndCount`),
2. objednávky načetl přes **`getOrdersListWorkflow`** s `filters: { id: [...] }` —
   tím se `total`, `payment_status` i `fulfillment_status` dopočítají nativně,
3. `production_order` načetl **správným směrem**:
   `query.graph({ entity: "production_order", fields: ["id","stage","order.id"], filters: { order_id: [...] } })`.

*Proč ne čistě nativní `/admin/orders`?* Protože filtrovat podle stage vlastního modulu
nativní endpoint neumí. Zůstává tedy vlastní endpoint, ale **veškerá order data pochází
z nativního workflow** — žádná ruční projekce.

**Ověření:** total v Denní práci se rovná totálu na detailu objednávky; badge stavu platby
ukazuje `captured` po ComGate platbě.

### Slice 2 — nativní navigace

* `<a href>` → `Link` / `useNavigate` z `react-router-dom`.
* Smazat `getOrderHref()`.
* Formátování částek → `getStylizedAmount()`.

**Ověření:** klik na „Otevřít objednávku" je okamžitý, bez reloadu.

### Slice 3 — „Odesláno" spustí nativní fulfilment

Nové workflow `shipMerchantOrderWorkflow`, které uvnitř volá
`createOrderFulfillmentWorkflow` a `createOrderShipmentWorkflow` (`runAsStep`),
a teprve po jejich úspěchu přepne `merchant_order_state` na `shipped`.

*Proč vlastní workflow?* Nativní workflow existují, ale žádné je nespojuje do jednoho
kroku a nedoplňuje merchant stav. Vlastní workflow je zde **orchestrátor**, ne náhrada —
veškerá byznys logika zůstává v nativních workflows a v DB se přímo nezapisuje nic
kromě `merchant_order_state`.

**Ověření:** po kliknutí má objednávka v nativním detailu fulfilment i shipment,
`fulfillment_status = shipped`.

### Slice 4 — obousměrná synchronizace

* Subscriber na `shipment.created` / `order.fulfillment_created` → `merchant_order_state.stage = "shipped"`.
* Subscriber na `payment.captured` / `order.updated` → uvolnit `payment_problem`.
* Odstranit `setMerchantStage()` z `made-to-order` a volat `transitionMerchantOrderWorkflow`.
* Buď smazat mrtvý `emitEventStep("merchant-order.stage-changed")`, nebo na něj napojit
  notifikaci zákazníkovi.

**Ověření:** fulfilment vytvořený na nativní stránce se projeví v Denní práci a naopak.

### Slice 5 — rozpad na routes

* `src/admin/routes/merchant-orders/` → `src/admin/routes/denni-prace/`.
* **Odstranit `nested: "/orders"`** (jinak dashboard potomky zahodí).
* Vytvořit pět podstránek se sdílenou komponentou seznamu, lišící se jen stage.
* Seznamy postavit na `DataTable` + `useDataTable`.
* Registrovat `@medusajs/draft-order` v `medusa-config.js` → `Objednávky └ Draft Orders`.

**Ověření:** postranní lišta odpovídá bodu 3.2; přímý vstup na `/app/denni-prace/nove` funguje.

### Slice 6 — odvozený stav místo ručního

* „Problém s platbou" odvozovat z `payment_status`, nikoli z ručního přepnutí.
* Sjednotit stavy na jeden zdroj pravdy: nativní status + tenký merchant overlay.

### Slice 7 — widget na detailu objednávky

Widget v zóně `order.details.side.before` se stavem Denní práce a **toutéž jedinou akcí**,
volající totéž workflow.

### Slice 8 — konfigurace layoutu (bez kódu)

S klientkou projít admin, skrýt nepoužívané sekce a uložit jako systémový default
přes layout customization.

---

## 6. Rizika

| Riziko | Dopad | Mitigace |
| --- | --- | --- |
| **Přechod `nested` → top-level změní URL** z `/merchant-orders` na `/denni-prace` | Uložené záložky přestanou fungovat | Ponechat `/merchant-orders/page.tsx` jako redirect bez `label` (bez labelu se do lišty nedostane) |
| **Fulfilment vyžaduje stock location a shipping option** | `createOrderFulfillmentWorkflow` selže, když objednávka nemá řešitelnou lokaci | Ve Slice 3 nejdřív načíst `listShippingOptions`; při nejednoznačnosti nabídnout výběr místo tichého selhání |
| **Nelze zablokovat fulfilment nezaplacené zakázky přes workflow hook** | `can_fulfill` z `made-to-order` je dnes jen informativní | `createOrderFulfillmentWorkflow` vystavuje pouze hook `fulfillmentCreated` (post-hoc), nikoli `validate`. Blokovat lze jen middlewarem na `POST /admin/orders/:id/fulfillments` |
| **Objednávky bez `merchant_order_state`** zmizí ze všech front | Klientka objednávku neuvidí | Backfill skript + fallback „objednávky bez stavu" ve frontě „Nové" |
| **Historické `payment_problem` stavy** po Slice 6 | Nekonzistence po migraci na odvozený stav | Jednorázová rekonciliace proti `payment_status` |
| **`getOrdersListWorkflow` s velkým `id[]`** | Pomalý dotaz | Držet page size ≤ 50; Query batchuje po 4000 id, což stačí |
| **Duplicitní zdroj pravdy zůstane, pokud se Slice 4 odloží** | Divergence se vrátí | Slice 3 a 4 nasadit společně |
| **`isQueryable` na vlastních modulech** bylo v commitu `7ccaf6a` přidáno a v `3d8af29` zase odebráno | Read-only linky by při chybě registrace přestaly fungovat | Po Slice 1 explicitně ověřit, že `query.graph` na `production_order` vrací `order.*` |

---

## 7. Oficiální reference

**Dokumentace**

* Admin UI Routes (`defineRouteConfig`, zanořené routes, `nested`, `rank`) — https://docs.medusajs.com/learn/fundamentals/admin/ui-routes
* Admin Widgets a injection zones — https://docs.medusajs.com/learn/fundamentals/admin/widgets
* Read-only module links (jednosměrnost) — https://docs.medusajs.com/learn/fundamentals/module-links/read-only
* Query / `query.graph` — https://docs.medusajs.com/learn/fundamentals/module-links/query
* Workflows a hooks — https://docs.medusajs.com/learn/fundamentals/workflows
* `createOrderFulfillmentWorkflow` — https://docs.medusajs.com/resources/references/medusa-workflows/createOrderFulfillmentWorkflow
* `createOrderShipmentWorkflow` — https://docs.medusajs.com/resources/references/medusa-workflows/createShipmentWorkflow
* `getOrdersListWorkflow` — https://docs.medusajs.com/resources/references/medusa-workflows/getOrdersListWorkflow
* Payment webhook events — https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events
* Admin API – Create Fulfillment — https://docs.medusajs.com/api/admin#orders_postordersidfulfillments
* Admin API – Create Shipment — https://docs.medusajs.com/api/admin#orders_postordersidfulfillmentsfulfillment_idshipments

**Zdrojový kód 2.18.0 (`backend/node_modules/`)**

| Tvrzení | Soubor |
| --- | --- |
| Jádrové položky lišty jsou natvrdo; `nested` se vkládá do `route.items` | `@medusajs/dashboard/src/components/layout/main-layout/main-layout.tsx:181-260, 295-357` |
| Strom podle cesty; potomci pod `nested` rodičem se zahazují | `@medusajs/dashboard/src/dashboard-app/dashboard-app.tsx:163-232` |
| Povolené hodnoty `nested` | `@medusajs/admin-shared/dist/index.d.ts` (`NESTED_ROUTE_POSITIONS`) |
| Layout customization (osobní / systémový default) | `@medusajs/dashboard/src/hooks/use-layout-preference.ts`; `@medusajs/medusa/dist/api/admin/layouts/[zone]/configuration/route.js` |
| `payment_status` / `fulfillment_status` se dopočítávají v aplikaci | `@medusajs/core-flows/dist/order/utils/aggregate-status.js`; `.../workflows/get-orders-list.js:50-90` |
| `Order` je nemá; `OrderDetail` ano | `@medusajs/order/dist/schema/index.js:274-345` vs `:557-630` |
| Totály se počítají jen když je `total` v `select` | `@medusajs/order/dist/services/order-module-service.js:154-208` |
| Totály potřebují `unit_price` | `@medusajs/utils/dist/totals/line-item/index.js:49` |
| Neznámá pole MikroORM tiše zahodí | `@mikro-orm/knex/AbstractSqlDriver.js:1277-1280, 1300-1330` |
| Read-only link registruje relaci jen na `serviceA` | `@medusajs/utils/dist/modules-sdk/define-link.js:298-336` |
| Draft-order plugin deklaruje `nested: "/orders"` | `@medusajs/draft-order/.medusa/server/src/admin/index.js` |
| `createOrderFulfillmentWorkflow` má pouze hook `fulfillmentCreated` | `@medusajs/core-flows/dist/order/workflows/create-fulfillment.js:406-412` |

---

## 8. Rozhodnutí k odsouhlasení

1. **Denní práce se odpojí od „Objednávky"** a stane se samostatnou top-level sekcí
   s pěti podstránkami. Bez toho nelze požadavek 2 splnit.
2. **„Objednávky" zůstanou nativní**, doplněné o Draft Orders registrací oficiálního pluginu.
3. **Zdrojem pravdy pro peníze a expedici je nativní Medusa.** `merchant_order_state`
   degraduje na tenký overlay „co má majitelka udělat teď".
4. **Vlastní kód jen tam, kde nativní chybí:** filtrování podle stage vlastního modulu,
   orchestrace fulfilment + shipment do jednoho kroku, obousměrná synchronizace.
   Vše ostatní se přepíše na nativní workflows a komponenty.

---

## 9. Implementační log

Schváleno v plném rozsahu (Slice 0–8). Každý slice byl ověřen `pnpm typecheck` +
`medusa build` (backend i admin) před pokračováním na další.

> **Poznámka k `pnpm lint`:** backend nemá a nikdy neměl ESLint — žádná konfigurace,
> žádná závislost. Nebyl tedy fabrikován; verifikační brána je `typecheck` + oba buildy.
> Zavedení ESLintu na dosud nelintovaný kód je samostatný úkol (vygeneruje stovky
> nálezů v nesouvisejících souborech) — viz otevřené body v sekci 11.

| Slice | Obsah | Ověření |
| --- | --- | --- |
| 0 | Přidán skript `typecheck` (`tsc --noEmit`) | typecheck 0 chyb, build zelený |
| 1 | Oprava čtení dat | typecheck + build |
| 2 | Nativní SPA navigace, sdílené formátování | typecheck + build |
| 3 | „Odesláno" spouští nativní fulfilment | + ověřeno, že workflow se zkonstruuje za běhu |
| 4 | Obousměrná synchronizace | + ověřena registrace subscriberu a jeho eventů |
| 5 | Top-level sekce + Draft Orders | + ověřena vygenerovaná struktura menu v admin bundlu |
| 6 | Odvozený stav platby | + ověřeno chování `payment-state` na sestaveném výstupu |
| 7 | Widget na detailu objednávky | + ověřena registrace do zóny `order.details.side.before` |
| 8 | Konfigurace layoutu | runbook níže (bez kódu) |

### 9.1 Architektonická rozhodnutí

**R1 — Denní práce zůstává vlastním endpointem, ale data o objednávkách bere nativně.**
Nativní `GET /admin/orders` neumí filtrovat podle `stage` vlastního modulu, takže vlastní
endpoint je nutný. Veškerá data o objednávce však nyní pocházejí z
`getOrdersListWorkflow` (výpis) a `getOrderDetailWorkflow` (detail). Ručně skládaná
projekce přes `query.graph` byla odstraněna — právě ta rozbíjela totály a tiše zahazovala
`payment_status`.

**R2 — `shipMerchantOrderWorkflow` je orchestrátor, ne implementace.**
Medusa nemá jeden vstupní bod, který by vytvořil fulfilment i zásilku a zaznamenal, že
je majitelka s objednávkou hotová. Workflow proto pouze skládá
`createOrderFulfillmentWorkflow` a `createOrderShipmentWorkflow` přes `runAsStep`.
Neobsahuje žádnou logiku skladu ani přímé zápisy do DB mimo `merchant_order_state`.
Kompenzace, eventy i práce se zásobami zůstávají Meduse. `location_id` se záměrně
nepředává — nativní workflow si ho odvodí ze shipping option objednávky, takže odpadá
jedno rozhodnutí navíc.

**R3 — Stav se mění výhradně přes workflow.**
`setMerchantStage()` v made-to-order zapisoval do modulu přímo, mimo zámek, mimo
validaci přechodů a bez kompenzace. Nyní volá `transitionMerchantOrderWorkflow`.

**R4 — Zaveden příznak `reconcile`.**
Tabulka přechodů popisuje, co smí *kliknout majitelka*. Realita jí ale vázaná není:
když se zásilka zruší nativně, fronta to musí odrazit, i když `shipped` nemá žádný
povolený odchozí přechod. Reconciliace proto guard přeskakuje — hlásí fakt, nepožaduje
změnu. Krok je idempotentní (stejný stav = no-op), protože doručení eventů je
at-least-once.

**R5 — Problém s platbou se odvozuje, nenastavuje.**
Zdrojem pravdy je nativní `payment_status`, počítaný Medusou v `getLastPaymentStatus()` —
tato funkce je veřejně dostupná z `@medusajs/medusa/core-flows`, takže se nic
nereimplementuje. `partially_captured` a `authorized` **nejsou** problém; jinak by každá
zakázková výroba se zaplacenou zálohou skončila ve frontě problémů.

**R6 — Vlastní formátování částek je odůvodněné.**
`getStylizedAmount()` v dashboardu existuje, ale **není veřejně exportováno** —
`@medusajs/dashboard` vystavuje jen `LayoutComposer`, `ConfigurableDataTable`,
`createTableAdapter` a `defineCellRenderer`. Import z `@medusajs/dashboard/src/...` by
sahal do interních částí balíčku a rozbil se při upgradu. Lokální helper
[format.ts](backend/src/admin/lib/format.ts) proto zůstává, ale chová se stejně jako
nativní: počet desetinných míst bere z měny, ne natvrdo.

**R7 — Denní práce ztratila `nested: "/orders"`.**
Bez toho by dashboard zahodil všech pět podstránek
(`dashboard-app.tsx:196-207`). Sekce je nyní top-level; `/merchant-orders` zůstává jako
redirect **bez** `config` exportu, takže se v liště neobjeví podruhé.

**R8 — Draft Orders je oficiální plugin, ne vlastní kód.**
Balíček byl už v závislostech, jen nezaregistrovaný. Přidán klíč `plugins` do
`medusa-config.js`.

### 9.2 Ověřená vygenerovaná navigace

Z admin bundlu po sestavení:

```
/denni-prace                      nested: undefined   rank: 0
/denni-prace/nove                 nested: undefined   rank: 10
/denni-prace/pripravujeme         nested: undefined   rank: 20
/denni-prace/k-odeslani           nested: undefined   rank: 30
/denni-prace/odeslano             nested: undefined   rank: 40
/denni-prace/problem-s-platbou    nested: undefined   rank: 50
/draft-orders                     nested: "/orders"
/merchant-orders                  (route bez menu položky — redirect)
```

Dashboard z toho podle `parentPath` složí `Denní práce` s pěti potomky a `Draft Orders`
pod nativní `Objednávky`.

---

## 10. Slice 8 — konfigurace layoutu (runbook)

Bez zásahu do kódu, provádí se v adminu a ukládá se pro všechny uživatele.

1. Přihlásit se jako admin, kliknout na ikonu přizpůsobení v horní liště a zvolit
   hosta **Main sidebar**.
2. Přetažením srovnat pořadí — `Denní práce` nahoru.
3. Ikonou oka skrýt sekce, které klientka nepoužívá (typicky *Ceníky*, *Slevy*,
   *Kampaně*, případně *Sklad*).
4. Uložit jako **systémový default** (`is_default`), aby se nastavení propsalo všem, ne
   jen aktuálnímu uživateli.
5. Totéž lze udělat pro pořadí widgetů na detailu objednávky (host **Page**).

Skrytí je pouze vizuální — routy zůstávají dostupné přímým URL, takže se tím nic
nerozbije.

### 9.3 Doplněno — přesný mechanismus a jeho hranice (2026-08-04)

Klientka požadovala konkrétní pořadí, které míchá nativní sekce s rozšířeními:
`Denní práce, Orders, Reviews, Promotions, Price lists, Products, Inventory, Customers`.

Ukázalo se, že to má tvrdou hranici: nativní sekce (`Orders`, `Products`, `Inventory`,
`Customers`, `Promotions`, `Price lists`) se vykreslují z pevného pole v
`useCoreRoutes()` uvnitř `@medusajs/dashboard` a **vždy** jako blok před všemi
rozšířeními — žádné `rank` ani `nested` v `defineRouteConfig` je nedokáže proložit
s rozšířeními ani posunout rozšíření nad ně. To se ověřilo přímo ve zdrojovém kódu
(`main-layout.tsx:295-357` — `{coreRoutes.map(...)}{extensionItems.map(...)}`,
sekvenčně, ne sloučeně).

Přeložit obojí umí jedině druhý mechanismus — layout customization —, protože ukládá
plochý číselný `order` na úrovni jednotlivé položky, bez ohledu na to, zda je nativní
nebo vlastní. Přesně dohledáno ve zdroji:

* **Zone klíč pro hlavní lištu je `"sidebar"`**, ne `"main-sidebar"` — to druhé
  (`CUSTOMIZE_IDS.MAIN_SIDEBAR`) pojmenovává jen který composer přejde do edit módu,
  API zone je `widgetsZonePrefix="sidebar"` z `main-layout.tsx`.
* **Schéma id položky je `core:nav:${path}`**, např. `core:nav:/orders`,
  `core:nav:/denni-prace` (`layout-composer/entries.ts:83-90`).
* **`order` je prostý číselný klíč řazení**, `0` když není nastaveno
  (`layout-composer/entries.ts:141-172`).
* **Endpoint**: `POST /admin/layouts/:zone/configuration`, tělo
  `{ is_default, configuration: { widgets: Record<id, { order?, hidden?, section? }> } }`
  (`@medusajs/medusa/dist/api/admin/layouts/[zone]/configuration/validators.js`).

V kódu bylo provedeno to, co jít mohlo:

* **Recenze přesunuty na top-level** (odstraněno `nested: "/products"`) — v požadovaném
  pořadí je uvedena vedle Orders, ne jako podpoložka Products.
* `Denní práce` už má `rank: 0`, takže mezi rozšířeními (bez uloženého layoutu) řadí
  jako první.

Zbytek pořadí (proložení s nativními sekcemi) vyžaduje zápis do sdíleného, perzistentního
stavu (`is_default: true` mění layout pro **všechny** adminy) — proto nebyl proveden
automaticky. Přesný payload a curl příkaz jsou v
[backend/scripts/set-sidebar-order.md](backend/scripts/set-sidebar-order.md), včetně
rollbacku (`DELETE` na stejný endpoint).

---

## 11. Co zůstává otevřené

* **ESLint** v backendu neexistuje. Doporučuji zavést samostatně, s `--max-warnings`
  bránou až po úklidu stávajících nálezů.
* **Backfill** `merchant_order_state` pro objednávky vzniklé před nasazením modulu —
  bez něj se ve frontách neobjeví. Widget na detailu objednávky se u nich prostě
  nevykreslí, což je bezpečné chování.
* **Jednorázová rekonciliace** historických `payment_problem` stavů proti aktuálnímu
  `payment_status`.
* **Blokace expedice nezaplacené zakázky.** `can_fulfill` v made-to-order je stále jen
  informativní. `createOrderFulfillmentWorkflow` vystavuje pouze hook `fulfillmentCreated`
  (post-hoc), nikoli `validate` — vynutit to lze jedině middlewarem na
  `POST /admin/orders/:id/fulfillments`.
* **Test na reálných datech.** Vše výše je ověřeno typecheckem, buildem a kontrolou
  sestaveného výstupu. Chování proti běžící databázi ověřeno nebylo — viz sekce 12.

---

## 12. Jak ověřit na běžícím prostředí

Buildy a statická analýza neprokážou runtime chování. Před nasazením ke klientce projít:

1. **Totály** — otevřít `Denní práce → Nové`, porovnat částku u objednávky s částkou
   na jejím nativním detailu. Musí sedět na haléř.
2. **Stav platby** — u objednávky zaplacené přes ComGate musí být zelený badge
   „Zaplaceno", ne „Stav platby neznámý".
3. **Otevřít objednávku** — musí přejít okamžitě, bez probliknutí celé aplikace.
4. **Expedice** — u objednávky v `K odeslání` kliknout „Vytvořit zásilku a odeslat".
   Poté na nativním detailu ověřit, že vznikl fulfilment **i** shipment a že
   `fulfillment_status` je `shipped`.
5. **Zpětná synchronizace** — vytvořit fulfilment ručně na nativním detailu jiné
   objednávky; ve frontě se musí sama přesunout do `K odeslání`.
6. **Navigace** — v postranní liště musí být `Denní práce` s pěti podpoložkami a
   `Objednávky → Draft Orders`. Stará URL `/app/merchant-orders` musí přesměrovat.

Body 4 a 5 vyžadují objednávku se shipping method navázanou na stock location —
jinak nativní workflow neumí odvodit lokaci a expedici odmítne.

---

*Implementace Slice 0–8 dokončena a staticky ověřena. Runtime ověření dle sekce 12 zbývá.*
