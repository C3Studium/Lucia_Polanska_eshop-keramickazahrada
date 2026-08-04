# WorkflowPlan — Admin operating plan for Keramická zahrada

**Status:** authoritative implementation specification — approved for implementation scheduling
**Target:** Medusa 2.18.0, existing repo (`backend/`), Railway deployment
**Date:** 2026-08-04
**Language convention:** spec text in English (implementer-facing); **all UI copy, labels, emails and helper texts in Czech** (client-facing). Czech strings in this document are the literal strings to ship.

Every factual claim about the current repo below was verified against source (file paths given). The implementing model must not re-derive these; where a claim needs runtime verification it is explicitly listed in Phase 0.

---

## 1. Executive summary

**Purpose.** Turn the admin from a developer console into a work instrument for one person: the owner of a handmade ceramics shop, ~50, non-technical, Czech-speaking. She packs, glazes, fires, answers customers and ships. The admin's job is to answer *"co mám udělat teď?"* — never to teach her Medusa.

**The operational problems it solves:**

1. **Fragmented daily work.** Orders, custom production, payments and stock live on separate technical pages. → One dashboard (Přehled) + one queue system (Denní práce) with a single obvious action per order.
2. **Silent lifecycle.** 34 Czech e-mail templates already exist in [backend/src/modules/resend/emails/](backend/src/modules/resend/emails/) but only ~7 flows are wired (order-placed, abandoned cart, restock, auth e-mails). Customers never hear "zaplaceno", "odesláno", "doplatek prosím". → Wire the existing templates to native events; almost no new templates needed.
3. **No merchant awareness.** The admin bell is dead (no `feed` notification provider registered) and no merchant e-mails exist. → Register `@medusajs/notification-local` for the `feed` channel (the bell reads channel `"feed"` — `dashboard/src/components/layout/notifications/notifications.tsx:101`), add a daily summary e-mail.
4. **Shipping is half-broken.** Česká pošta provider is a stub without `createFulfillment` ([service.ts](backend/src/modules/ceskaPostaFulfillment/service.ts)) — any ČP order fails the one-click ship. Packeta provider sends **COD for every order** (`cod: Math.round(order.total)`) and hardcodes weight 2.5 kg ([service.ts](backend/src/modules/zasilkovnaFulfillment/service.ts)). → Fix both; carrier API correctness is a P0.
5. **English/Czech mix.** → Native dashboard ships a complete Czech locale (`dashboard/src/i18n/translations/cs.json`: Objednávky, Produkty, Sklad, Zákazníci, Koncepty objednávek…). Setting the user's language to Czech fixes ~90 % of terminology **with zero code**.

**Expected effort reduction:** a normal paid order goes from ~9 interactions across 3 pages to **2 clicks on 1 page** (Začít připravovat → Vytvořit zásilku a odeslat). Payment problems, low stock and pending reviews surface themselves instead of being discovered.

**Principles:** native data stays authoritative; custom modules are thin overlays (state, presentation, thresholds); every commerce-state mutation goes through a native workflow; backend validates everything; automations replace status bookkeeping; one situation → one next action; Czech everywhere; Settings untouched.

**Remains native Medusa:** orders, draft orders, payments, fulfilment, inventory, reservations, products, variants, options, collections, categories, price lists, promotions, campaigns, customers, notification storage/audit, Settings, order/product detail pages.

**Custom (existing, kept):** merchant-order (queue stage), made-to-order (production lifecycle + deposits), merchant-catalog (presentation + seasonal selections), bundled-product, product-review, restock, wishlist, comgate provider, resend templates, fulfilment providers.

**Custom (new, justified individually in this plan):** operations-summary read endpoint; low-stock thresholds + one tiny key-value `merchant-settings` module; seasonal-selection admin UI (API already exists, UI missing — verified `grep seasonal src/admin/` = 0 hits); e-mail wiring subscribers; payment-link workflow generalized from the existing made-to-order balance flow.

---

## 2. Complete Admin information architecture

### 2.1 Hard platform constraints (verified, non-negotiable)

| Constraint | Source |
| --- | --- |
| Native sidebar items are a fixed block rendered before extension items; `rank`/`nested` cannot interleave them | `dashboard/src/components/layout/main-layout/main-layout.tsx:295-357` |
| An extension route with `nested` set cannot have children | `dashboard/src/dashboard-app/dashboard-app.tsx:196-207` |
| `nested` only accepts `/orders`, `/products`, `/inventory`, `/customers`, `/promotions`, `/price-lists` | `@medusajs/admin-shared` `NESTED_ROUTE_POSITIONS` |
| Cross-boundary ordering + hiding of sidebar items (incl. native children) is done via Layout Configuration, zone `sidebar`, entry ids `core:nav:/<path>`, children `nav-child:/<parent>:/<path>`, saved with `is_default: true` | `dashboard/.../layout-composer/entries.ts`, `nav-item.tsx`, `POST /admin/layouts/sidebar/configuration` |
| **Sidebar items cannot show badge counts** (INavItem has no badge) → counts live on Přehled, page headers and the bell | `dashboard/.../nav-item.tsx` |
| `/` always redirects to `/orders` (native home) — cannot be overridden | `dashboard/src/routes/home/home.tsx:8` |
| Widget `.before/.after` suffixes are inert since 2.17.2; position is governed by Layout Configuration | docs: Admin Widgets |

### 2.2 Final sidebar (deviations from the proposed structure are marked ⚠ and justified)

With the client's profile language set to **Czech** (Nastavení → Profil), native labels below render as shown.

```
Přehled                          C   /prehled            — work dashboard (NEW)
Denní práce                      C   /denni-prace        — exists (Slices 0–8)
 ├ Nové · Připravujeme · K odeslání · Odesláno · Problém s platbou
Objednávky                       N   /orders
 └ Koncepty objednávek           P   /draft-orders       — draft-order plugin (registered)
Zakázková výroba                 C   /zakazkova-vyroba   — promoted to top level (NEW section)
 ├ Zakázky                       C   /zakazkova-vyroba/zakazky      — grouped production queue
 └ Produkty na zakázku           C   /zakazkova-vyroba/produkty     — moved from /made-to-order
Sklad                            N   /inventory
 ├ Rezervace                     N   /reservations
 ├ Nízký stav                    C   /sklad-nizky-stav   (nested:"/inventory", NEW)
 └ Vyprodáno                     C   /sklad-vyprodano    (nested:"/inventory", NEW)
Produkty                         N   /products
 ├ Možnosti produktů             N   /product-options    — "Vlastnosti" (reusable options)
 ├ Kolekce a kategorie           C   /merchant-catalog   — existing composed page
 └ Balíčky                       C   /bundled-products   — existing
Recenze                          C   /reviews            — existing, single page + tabs
Sezónní výběry                   C   /sezonni-vybery     — NEW UI over existing API
Propagace                        N   /promotions         — "Slevy a kupóny" concept
 └ Kampaně                       N   /campaigns
Zákazníci                        N   /customers
 └ Skupiny zákazníků             N   /customer-groups
──────────────────────────────
Nastavení                        N   /settings           — untouched
```

**Hidden via sidebar Layout Configuration default** (URL-reachable, linked contextually): Ceníky (`/price-lists`), native Kolekce (`/collections`) and Kategorie (`/categories`) children, Sanity CMS, Segment Analytics.

**Sidebar order** is applied with the already-documented default-layout payload ([backend/scripts/set-sidebar-order.md](backend/scripts/set-sidebar-order.md)), extended with the new entries and `hidden: true` rows.

### 2.3 Per-section rationale

| Section | Why it exists | Client activity | Type | Count shown | Visibility |
| --- | --- | --- | --- | --- | --- |
| Přehled | answers "co teď?" | reads tiles, clicks into queues | C (composed reads) | all counts live here | always |
| Denní práce | the one order pipeline | 1-click stage actions | C over native workflows | header counts per stage | always |
| Objednávky | full history + native detail | search, refunds, edits | N | — | always |
| Koncepty objednávek | manual/phone orders | create, complete → becomes order | P (official plugin) | — | always |
| Zakázková výroba | production lifecycle Medusa lacks | confirm specs, price, deposits, balance | C (existing module) | on Přehled | always |
| Sklad | native inventory truth | adjust quantities | N | — | always |
| Nízký stav / Vyprodáno | she thinks in these terms | restock decisions | C read-only filters over native | on Přehled | always |
| Produkty | catalogue | create/edit products | N | — | always |
| Kolekce a kategorie | native CRUD + presentation in one place | organize storefront | C composed (existing) | — | always |
| Balíčky | sets of ceramics | compose bundles | C (existing) | — | always |
| Recenze | moderation queue | approve/reject | C (existing) | on Přehled | always |
| Sezónní výběry | editorial + optional sale in one concept | seasonal storefront curation | C (API exists, UI new) | on Přehled (ending soon) | always |
| Propagace | discount codes | create codes | N | — | always |
| Zákazníci | people | look up, contact | N | — | always |
| Nastavení | technical config | rarely | N | — | always, bottom |

**Removed/merged/renamed relative to the proposed structure:**

- ⚠ **Balíčky is NOT top-level with 3 children.** Bundle volume is small; draft/published is the linked native product's status. One page with a status filter beats three near-empty pages. Kept as a Produkty child (existing route).
- ⚠ **Recenze subpages collapsed into tabs** on one page (Čekají na schválení default). The review model's statuses are already Czech enum values (`"čeká na schválení" | "schváleno" | "zamítnuto"` — [models](backend/src/modules/product-review/models/)); tabs map 1:1.
- ⚠ **Akční ceny is NOT a v1 top-level section.** Sale pricing flows through Sezónní výběry (the module already links `linked_price_list_id` to a native price list — [seasonal-selection.ts](backend/src/modules/merchant-catalog/models/seasonal-selection.ts)) and advanced cases through hidden native Ceníky. A standalone simplified sale wizard is Phase 9 optional. Reason: two sale entry points = the exact confusion §13 must prevent.
- ⚠ **Zakázková výroba has 2 children, not 5.** Production volume is handmade-scale; five near-empty stage pages hide the whole picture. One grouped queue page (stage sections stacked, each with count + its one action) shows everything at a glance. Stage anchors give deep links. Denní práce keeps per-stage pages because order volume is higher and stages map to physical batching (pack table, post office run).
- **Native Kolekce/Kategorie children hidden**, because the composed page creates/edits the same native records through native workflows ([manage-merchant-collection.ts](backend/src/workflows/manage-merchant-collection.ts)) plus presentation; two lists for one concept caused the "Categories vs Kolekce a kategorie" ambiguity flagged in the earlier audit. Escape hatch: "Otevřít technický detail" links.
- **Sanity CMS / Segment hidden** — developer tools.
- **Denní práce ⟷ Objednávky relationship** unchanged from the repaired design (queue vs archive, §6).

---

## 3. Visual workflow map

Legend: `[K]` client action · `[A]` automatic · `[@Z]` customer e-mail · `[@M]` merchant notification (bell/e-mail) · `(N)` native mechanism · `(C)` custom.

### 3.1 Normal paid order

```
Customer pays via ComGate
  ↓ [A] verified server callback → processPaymentWorkflow (N)      src/api/hooks/payment/pp_comgate_comgate
  ↓ [A] cart completes → order.placed (N)
  ↓ [A] merchant_order_state = Nové (C, payment-derived)           src/subscribers/initialize-merchant-order.ts
  ↓ [@Z] „Potvrzení objednávky" (order-placed — EXISTS, wired)
  ↓ [@Z] „Platba přijata" (payment-received — EXISTS, wire in P5)
  ↓ [@M] bell „Nová zaplacená objednávka #123" (P2)
Denní práce → Nové
  ↓ [K] „Začít připravovat"
Připravujeme (no customer e-mail — noise; optional toggle later)
  ↓ [K] „Připraveno k odeslání"
K odeslání
  ↓ [K] „Vytvořit zásilku a odeslat" → shipMerchantOrderWorkflow (C orchestrator)
        ├ createOrderFulfillmentWorkflow (N)  → inventory decremented, reservations resolved
        ├ carrier createFulfillment (Packeta API / ČP record)      ← P4 fixes
        └ createOrderShipmentWorkflow (N)     → fulfillment_status = shipped
  ↓ [A] stage = Odesláno (only on success)
  ↓ [@Z] „Objednávka odeslána" + tracking (order-shipment — EXISTS, wire in P5)
Odesláno
  ↓ [A] +10 days job → [@Z] „Jak se vám líbí?" (order-review — EXISTS, wire in P6/P9)
  ↓ [K] optional „Označit jako doručené" (markAsDelivered N)
```

### 3.2 Made-to-order order

```
Customer orders MTO product, writes specification, pays DEPOSIT (ComGate)
  ↓ [A] order.placed → production_order (stage per specification) + payment snapshot (C, exists)
  ↓ [@Z] order-placed  ↓ [@M] „Nová zakázka — přečtěte si zadání"
Zakázková výroba → Zakázky (specification_pending)
  ↓ [K] reads note → phone/e-mail customer if unclear ([K] „Kontaktovat zákazníka")
  ↓ [K] „Potvrdit zadání a cenu" (final price) → native Order Edit chain (N, exists)
  ↓ [@Z] „Zadání potvrzeno" (spec-approved: reuse order-processing or small new template)
confirmed → [K] „Začít výrobu" → in_production
  ↓ (estimated_completion_at tracked; overdue ⇒ Přehled warning)
  ↓ [K] „Výroba dokončena"
  ├ fully paid → ready_to_ship
  └ else → awaiting_balance
        ↓ [K] „Požádat o doplatek" → payment collection + ComGate session (N, exists)
        ↓ [@Z] „Prosíme o doplatek" + link (payment-pending — EXISTS; **wire: event
              made-to-order.balance-requested currently has NO subscriber** → P5)
        ↓ [A] ComGate callback → request paid → ready_to_ship (C, exists)
        ↓ [@Z] „Doplatek přijat" (payment-received)  ↓ [@M] bell
ready_to_ship  →  order appears in Denní práce → K odeslání
  ↓ [K] one click ship (ship BLOCKED while outstanding > 0 — enforcement added in P3)
completed
```

### 3.3 Failed / expired payment

```
ComGate cancelled/expired (callback or reconciliation job P6)
  ↓ [A] payment_status stays not_paid/awaiting → stage = Problém s platbou (derived, exists)
  ↓ [@M] bell + urgent e-mail „Platba u #123 neproběhla"
  ↓ [@Z] „Platba se nezdařila" + new payment link (payment-failed — EXISTS, wire P5)
Problém s platbou
  ├ [K] „Poslat platební odkaz znovu" (idempotent reuse of open collection)
  ├ [K] „Kontaktovat zákazníka"
  └ [K] „Zrušit objednávku" → cancelOrderWorkflow (N) [+ refund if partially paid]
        ↓ [@Z] order-cancelled (EXISTS)
  ↓ [A] payment.captured later → auto-return to Nové (exists, Slice 6)
```

### 3.4 Bundle order

```
Customer adds bundle → component variants become real line items with bundle metadata (C, exists)
  → inventory & totals fully native from here; Denní práce card groups items visually
    under „Balíček: {title}" (P7); ships as normal order (3.1)
```

### 3.5 Pickup-point order — ⚠ superseded by D8 (§26): Packeta is being retired; this flow maps 1:1 onto Balíkovna výdejní místa once the storefront picker exists (P4-3 dependency). Mechanics below stay valid, provider changes.

```
Checkout stores pickup point → cart.metadata.packeta_pickup_point → shipping_address.metadata (exists)
Denní práce card shows „Výdejní místo: {name/ID}"
K odeslání: ship action VALIDATES pickup point present, else blocks with
  „Chybí výdejní místo — kontaktujte zákazníka" (P4)
Packeta createPacket → barcode → labels/tracking on shipment (P4)
  ↓ [@Z] order-shipment with „Zásilku vyzvednete zde: …" variant
(Packeta delivery webhooks: NOT in v1 — no delivered state pretense)
```

### 3.6 Order requiring customer contact

```
Any stage → [K] „Kontaktovat zákazníka" (card secondary action)
  opens prefilled mailto: (v1) / send-from-admin modal (P5+)
  + [K] optional internal note (merchant_order_state.internal_note — exists)
No stage change — contacting is not a pipeline state (deliberate; avoids parking orders)
```

### 3.7 Partial payment (deposit paid, balance open)

Covered by 3.2; invariant everywhere: **`captured < total` ⇒ ship action disabled** with Czech reason, both in queue UI and backend guard (P3/P4). `partially_captured` never lands in Problém s platbou (Slice 6 decision — deposits are healthy).

### 3.8 Cancellation / refund

```
[K] „Zrušit objednávku" (queue or native page) → confirm dialog with consequences
  → cancelOrderWorkflow (N) → order.canceled event
  → [A] NEW subscriber: stage = cancelled (P3)  ↓ [@Z] order-cancelled (EXISTS, wire P5)
Refund of captured money: native payment refund (ComGate refundPayment verified —
  src/modules/comgate/service.ts:423) from native order page
  ↓ [@Z] payment-refunded / order-refunded (EXIST, wire P5)  ↓ [@M] bell
```

### 3.9 Inventory / restock

```
Sale decrements inventory (N, automatic)
  ↓ [A] daily 07:00 job + inventory-level event listener (P7)
  ├ available ≤ threshold → [@M] „Dochází: {product}" (dedup per item per day)
  └ available = 0        → [@M] „Vyprodáno: {product}" + Přehled tile
[K] restocks via Sklad (native adjust)
  ↓ [A] existing check-restock job (00:00) e-mails subscribed customers (restock — EXISTS, wired)
```

---

## 4. Dashboard plan — „Přehled" (`/prehled`)

Not analytics. Three zones: **(1) Vyžaduje pozornost** (red, only when non-empty), **(2) Dnešní práce** (the pipeline), **(3) Obchod** (stock/reviews/marketing). No charts — nothing here needs a trend to act.

Data: one new endpoint `GET /admin/operations/summary` (C, read-only aggregation; single round-trip) composing: merchant-order stage counts (exists), production stage counts + overdue + outstanding balances, review pending count, low-stock/sold-out counts, notification failures (native notification table, `status = failure` — model has `status` + unique `idempotency_key`, verified `@medusajs/notification/dist/models/notification.js:30-34`), price lists / selections ending ≤ 7 days.

| Tile | Zone | Source | N/C | Empty state | Warning state | Primary action → destination |
| --- | --- | --- | --- | --- | --- | --- |
| Problémy s platbou | 1 | stage counts | C | hidden | count > 0 (red) | „Vyřešit" → /denni-prace/problem-s-platbou |
| Nezdařené e-maily | 1 | notifications status=failure | N | hidden | count > 0 | „Zobrazit a poslat znovu" → /prehled/emaily |
| Zásilky se nepodařilo vytvořit | 1 | feed notifications category carrier-fail | C | hidden | count > 0 | → K odeslání (failed rows flagged) |
| Zpožděné zakázky | 1 | production_order overdue (estimated_completion_at < now, not terminal) | C | hidden | count > 0 | → Zakázky |
| Nové objednávky | 2 | stage received | C | „Žádné nové — máte klid ☕" | — | „Začít" → /denni-prace/nove |
| Připravujeme | 2 | stage working | C | „Nic rozpracovaného" | — | → /denni-prace/pripravujeme |
| K odeslání | 2 | stage shipping | C | „Vše odesláno" | age > 3 dny | → /denni-prace/k-odeslani |
| Čeká na doplatek | 2 | production awaiting_balance (+ sum outstanding Kč) | C | hidden if 0 | request > 7 dní | → Zakázky#doplatek |
| Ve výrobě | 2 | production in_production + nearest deadline | C | „Žádná zakázka ve výrobě" | deadline ≤ 3 dny | → Zakázky |
| Dochází na skladě | 3 | low-stock query | C | „Zásoby v pořádku" | count > 0 | → /sklad-nizky-stav |
| Vyprodáno | 3 | available = 0 | C | hidden if 0 | always when shown | → /sklad-vyprodano |
| Recenze ke schválení | 3 | review status „čeká na schválení" | C | „Žádné nové recenze" | count > 5 | → /reviews |
| Končí brzy | 3 | price lists + selections ends_at ≤ 7 d | N+C | hidden | always when shown | → Sezónní výběry |

Below tiles: **„Na řadě"** — max 5 order cards (oldest actionable first: payment problems, then Nové, then K odeslání) reusing the Denní práce card component verbatim, each with its one action inline. Global empty state: „Dnes nic nehoří. Všechno zvládnuto 🎉".

Badge counts: only here + page headers + bell (sidebar can't badge — §2.1).

---

## 5. Denní práce workflow

Baseline = repaired implementation (audit §9). This section specifies the remaining deltas.

### 5.1 Stage contract

| | Nové | Připravujeme | K odeslání | Odesláno | Problém s platbou |
| --- | --- | --- | --- | --- | --- |
| **Entry (native truth)** | order.placed ∧ payment ∈ {captured, authorized, partially_captured(MTO)} | manual from Nové; MTO spec-confirm side-effect | manual; or [A] fulfilment created natively | [A] shipment.created only | derived: payment ∈ {not_paid, awaiting, requires_action, canceled} |
| **Custom state** | stage row (overlay only) | stage | stage | stage | stage + reason (derived wins — Slice 6) |
| **Primary action** | Začít připravovat | Připraveno k odeslání | **Vytvořit zásilku a odeslat** → in record-only carrier mode two-phase: „Zásilku jsem předala dopravci" (§5.4/A1) | (none) / Označit jako doručené (secondary) | Poslat platební odkaz |
| **Secondary** | Otevřít objednávku · Kontaktovat | idem | idem + Vrátit do Připravujeme | Otevřít · Kontaktovat | Kontaktovat · Zrušit objednávku |
| **Forbidden (UI hidden + backend-rejected)** | ship | ship | ship if: unpaid balance ∨ not captured (non-COD) ∨ Packeta without pickup point | any stage action | ship, prepare |
| **Auto transitions in** | payment.captured (from problem) ✅exists | — | order.fulfillment_created ✅ | shipment.created ✅ | order.placed unpaid ✅; NEW: expiry job (P6) |
| **Auto transitions out** | — | — | fulfilment canceled → working ✅ | — | payment.captured → Nové ✅; NEW: order.canceled → cancelled (P3) |
| **Customer e-mail** | payment-received (P5) | — (deliberate) | — | order-shipment (P5) | payment-failed + link (P5) |
| **Merchant notif.** | bell new-paid-order | — | carrier-fail bell+email | — | bell + urgent e-mail |
| **Failure handling** | — | — | workflow throws → stage unchanged, Czech toast, feed notif, row badge „Nepodařilo se — zkusit znovu" (safe retry: open fulfilment reuse ✅) | — | link creation reuses open collection ✅ (idempotent — actions/route.ts pattern) |

### 5.2 Card layout (list rows, no table for queues)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ #1042 · 12.08. 14:31        Jana Nováková                     1 890 Kč       │
│ 3 položky · Zásilkovna – Výdejní místo: Brno, Kobližná 2      [Zaplaceno]    │
│ [Balíček: Čajová souprava ×1]  [Zakázková výroba · ve výrobě]                │
│ ⚠ Chybí výdejní místo (only when blocking)                                   │
│                         [Otevřít objednávku]   [Vytvořit zásilku a odeslat]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Additions to current card: pickup point line (from `shipping_address.metadata.packeta_pickup_point`), bundle grouping chip, block-reason line, per-row failure badge. Payment badge map exists (Slice 1). Fulfilment state shown only as the block/allow logic + „Zásilka vytvořena" chip when `has_fulfillment` (field already in projection).

### 5.3 Remaining deltas (→ roadmap P3/P4)

1. **Ship gating (backend-authoritative):** extend `shipMerchantOrderWorkflow` with a validate step — reject when (a) MTO `production_order` outstanding > 0.005, (b) `payment_status ∉ {captured, partially_captured?COD-decision}` for non-COD, (c) Packeta method without pickup point. Same rules as middleware on native `POST /admin/orders/:id/fulfillments` (zone-agnostic protection; `createOrderFulfillmentWorkflow` exposes only a post-hoc hook — audit §6 — so middleware is the only pre-validation point).
2. **Pagination** (`limit/offset` exist server-side; UI fetches 100 flat) → pager at 50/page.
3. **Stale data:** `refetchInterval: 30_000` + refetch on window focus for queue queries.
4. **Reconciliation banner:** `GET /admin/merchant-orders/backfill-status` → count of orders without state rows; banner „{n} starších objednávek není ve frontách — Načíst" → idempotent backfill endpoint (creates rows via `initialStageForPayment`).
5. **order.canceled subscriber** → stage cancelled (reconcile map addition).
6. **Kontaktovat zákazníka:** v1 `mailto:` with prefilled subject „Vaše objednávka #{display_id} z Keramické zahrady".
7. **Duplicate-click:** UI `isPending` ✅; backend: transition lock ✅ + add same lock acquisition wrapping `shipMerchantOrderWorkflow` body.

### 5.4 Two-phase dispatch (A1) — „Čeká na ruční podání zásilky"

Applies whenever a fulfilment exists **without** a carrier-side record — i.e. the Balíkovna record-only fallback (`fulfillment.data.mode === "manual"`), or a fulfilment created on the native page before shipment.

- **Phase 1 — „Připravit zásilku"** (record-only mode): `shipMerchantOrderWorkflow` branches on the created fulfilment's `data.mode`. Manual mode ⇒ **stop after** `createOrderFulfillmentWorkflow` (inventory decremented, items packed — true facts). No shipment, no e-mail, no stage change to `shipped`. Stage stays `shipping`.
- **Blocking state is derived, no new column:** `stage = shipping ∧ has_fulfillment ∧ fulfillment.shipped_at = null` (both fields already in the projection). Card shows badge **„Čeká na ruční podání zásilky."** and the primary action becomes **„Zásilku jsem předala dopravci"**.
- **Phase 2 — handover confirm:** new thin workflow `confirmMerchantHandoverWorkflow` — validates an open unshipped fulfilment exists, runs `createOrderShipmentWorkflow` (native), lets the existing `shipment.created` reconciliation ✅ move stage to `shipped`, and the P5 subscriber send e-mail #11 (in this mode without tracking CTA — §16 rule). Confirm dialog: „Potvrzujete, že zásilka je předaná dopravci? Zákazníkovi odešleme e-mail o odeslání." Idempotent: second confirm finds no unshipped fulfilment → no-op with Czech notice.
- **API mode** (`data.mode === "api"`, real packet + tracking): both phases run in one click as designed — carrier record exists, e-mail with tracking is truthful.
- **Invariant strengthened:** `shipped` (stage, e-mail, native status) is *only ever* produced by a real `createOrderShipmentWorkflow` run — in any mode, from any entry point.

---

## 6. Orders and draft orders

| Question | Answer |
| --- | --- |
| Where does history live? | Native **Objednávky** (`/orders`) — every order ever, native filters/search/export. |
| Where do manual/phone orders live? | **Koncepty objednávek** (draft-order plugin). On completion Medusa emits `order.placed` (verified — `OrderWorkflowEvents.PLACED` doc: *"or when a draft order is converted"*), so it enters Denní práce automatically, no special handling. |
| Where does daily work live? | Denní práce only. It is a **view + one action**, never a second order store (overlay table has 7 columns of state, zero commerce data). |
| Full native detail? | „Otevřít objednávku" (SPA link ✅) + the Denní práce widget on the native order page shows queue stage + same action (Slice 7 ✅) — so both directions stay consistent. |
| What is summarized on cards vs native-only? | Cards: who, what, how much, payment badge, carrier + pickup point, block reasons, one action. Native-only: line-item edits, order edits, returns/claims/exchanges, refunds, payment collections detail, fulfilment/tracking objects, JSON/metadata, timeline. |
| Duplicate-concept avoidance | Queue pages never list non-actionable orders (`cancelled` hidden; `Odesláno` capped at last 30 days with „Starší najdete v Objednávkách" link). Native Objednávky stays unfiltered. One creation path for manual orders (Koncepty); Denní práce has no create. |

---

## 7. Made-to-order workspace („Zakázková výroba")

Module state (verified): `product_production_profile` (per-product: enabled, specification required+prompt, production 14–42 d, deposit % default 25, contact-after-order, final-price-adjust), `variant_production_profile` (overrides), `production_order` (7 stages), `production_payment_request` (deposit/balance snapshots with idempotency, provider ids, `expires_at`, `last_checked_at`). Money edits already go through native Order Edit; balance links through native payment collections (audit §1.2). Admin today: profile manager page + order widget. Missing: workspace queue UI, balance e-mail wiring, expiry reconciliation, ship lock enforcement, deadline surfacing.

### 7.1 Produkty na zakázku (`/zakazkova-vyroba/produkty` — existing page moved)

Per product: `Vyrábí se na zakázku [✓]`, `Zákazník musí popsat zadání [✓]` + „Co má zákazník napsat?" prompt, `Výroba od–do (dny)`, `Záloha (%)` with helper „Zbytek zaplatí zákazník po dokončení výroby.", per-variant overrides collapsed under „Upřesnit pro varianty". Validation: 1–100 % deposit, min ≤ max days. Plus product-detail widget „Na zakázku · záloha 25 % · 14–42 dní" linking here (P6).

### 7.2 Zakázky (`/zakazkova-vyroba/zakazky`) — grouped queue, stages stacked

Per step contract:

| Step | Client sees / does | Automatic | Customer e-mail | Merchant notif. | Backend validation | Native used | Custom |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Order arrives | card in „Nové zadání" with customer note verbatim | production_order + deposit snapshot created (✅ subscriber) | order-placed ✅ | bell „Nová zakázka" (P2) | idempotent by order_id ✅ | payment collections, order | production_order |
| Clarify (optional) | „Kontaktovat zákazníka" + internal note | — | manual mailto v1 | — | — | — | note field ✅ |
| Confirm spec + final price | „Potvrdit zadání a cenu" — price input prefilled, shows „Zákazník doplatí {X} Kč" | order total adjusted via Order Edit chain ✅; merchant stage → working ✅ | „Zadání potvrzeno" (P5; template: order-processing reworded or 1 new) | — | stage guard ✅; price > 0 ✅; **new:** price ≥ already-paid deposit (P6) | beginOrderEdit…confirm ✅ | stage machine ✅ |
| Start production | „Začít výrobu" (+ optional date edit) | timestamps ✅ | „Výroba začala" — **optional, default OFF** (merchant-settings toggle) | — | stage guard ✅ | — | ✅ |
| Deadline watch | overdue badge on card | Přehled tile + bell at deadline-3d and overdue (P6 job) | „Výroba se protáhne" — **manual send** button (order-delayed EXISTS) | bell | — | — | job |
| Complete production | „Výroba dokončena" | fully paid → ready_to_ship else awaiting_balance ✅ | — | — | ✅ | — | ✅ |
| Request balance | „Požádat o doplatek {X} Kč" | collection + ComGate session, reuse-if-open ✅ | **„Prosíme o doplatek" + link — MISSING WIRE** (event `made-to-order.balance-requested` emitted at actions/route.ts:324,412 — zero subscribers; P5 wires payment-pending template) | — | outstanding computed server-side ✅; idempotency key ✅ | createOrderPaymentCollection/PaymentSessions ✅ | request snapshot ✅ |
| Balance paid | card auto-moves to „Připraveno k odeslání" | ComGate callback marks paid, stage → ready_to_ship ✅ | „Doplatek přijat" (payment-received, P5) | bell (P2) | verified callback ✅ | processPaymentWorkflow ✅ | reconcile ✅ |
| Balance ignored | „Připomenout" **manual** resend (idempotent) + overdue badge at +7 d — no auto-reminder (D4) | expiry job: `last_checked_at`-driven ComGate status poll; expired → new-link state + bell (P6) | reminder only on her click | bell | poll idempotent | — | job |
| Ship | happens in Denní práce → K odeslání | **lock until outstanding = 0** (P3 gate) | order-shipment (P5) | — | workflow + middleware | full ship chain ✅ | gate |
| Done | „Dokončené" section (last 60 d) | completed on delivery-or-shipment+X? → v1: completed = shipped | review e-mail per §3.1 | — | — | — | ✅ |

Cancel at any pre-ship stage: exists ✅ (cancels open payment requests, stage cancelled, event emitted) — add customer e-mail decision to §16 and refund-of-deposit business question (§26 Q3).

---

## 8. Product management

Native product list + native editor stay (they are good and in Czech via locale). We add a **launcher** and **widgets** — we do not rebuild the editor.

### 8.1 „Nový produkt" launcher (`/products` header action or `/novy-produkt` route)

Four template cards. Each creates a native product via native admin API with sensible defaults, then redirects to the native editor (`/products/:id`) — composition, not duplication. Native create page can't be prefilled via URL, hence API-first creation.

| Template | Prefills | Then |
| --- | --- | --- |
| Jedinečný kus („jedna váza, jeden kus") | status draft, 1 variant, manage_inventory ✓, quantity 1, default sales channel + shipping profile | editor: add photo + price |
| Produkt s variantami („hrnek ve 3 barvách") | status draft, option „Barva" scaffold | native option/variant UI |
| Na zakázku | as unique + `manage_inventory=false` on variant + production profile created (module) | editor + profile drawer |
| Dárkový poukaz | native gift card product type (native support) | editor |

⚠ Bundle creation stays on Balíčky (existing composer) — not in this launcher, to keep one bundle path.

### 8.2 Editor guidance (widgets on native `product.details`)

- **Completeness widget** („Než publikujete"): checklist — photo, price CZK, category/collection, description, weight (needed for carriers). Warnings only; publish is never hard-blocked except price (native validation).
- **Na zakázku widget** (P6): profile summary + edit drawer.
- Existing widgets kept: express checkout link, Sanity sync, reviews, bundle details.
- Plain-language labels/help live in these widgets; native field labels are already Czech via locale. Advanced native sections (organizace, atributy, metadata) remain — hidden-by-default via page Layout Configuration default (widgets/sections reorder+hide, saved `is_default` — same mechanism as sidebar).

Field table (labels she sees; native cs locale strings in parentheses when native): Název (native), Popis (native), Fotografie (native media), Cena („Cena vč. DPH, Kč"), Skladem kusů (native inventory qty), Hmotnost — helper „Podle hmotnosti se počítá doprava." (native), Kategorie/Kolekce (native), Publikováno/Koncept (native status; confirm dialog on publish from completeness widget if checklist incomplete: „Produkt nemá fotografii. Opravdu publikovat?").

## 9. Collections, categories and properties

- **Single entry:** existing composed page `/merchant-catalog` („Kolekce a kategorie"). It already: creates/edits native collections (via native workflows), stores presentation (`collection_profile`: cover/mobile image, description, SEO title+description, ordering, storefront_visible), assigns categories to collections (`collection_category_assignment`, unique per category ✅ model), orders both.
- Native `/collections` + `/categories` children hidden (escape links „Technický detail" per row). Category **tree** editing (nesting/drag) is native-only → the composed page's category panel links „Uspořádat strom kategorií" to native `/categories` organize view — no re-implementation.
- **Vlastnosti** = native Možnosti produktů (`/product-options`, reusable options — native 2.18 feature, page exists in repo's dashboard). Helper widget text: „Vlastnosti (např. Barva, Průměr) vytvořte jednou a používejte u více produktů."
- **Unclassified products warning** (P8): banner on the composed page + Přehled tile variant — count of published products with no category, query-only.
- Ordering: `display_order` fields exist on profile + assignment ✅; UI drag within composed page.
- Storefront visibility: `storefront_visible` toggle ✅ — helper „Skryté kolekce zákazníci nevidí, produkty v nich ale zůstávají v prodeji."

Native: collection/category records, product assignment. Custom (existing): presentation profile, assignment ordering, seasonal linkage. New custom: none beyond warnings.

## 10. Inventory workflow

- **Truth:** native inventory items/levels/reservations. One stock location assumed (single workshop) — location complexity never shown; Phase 0 verifies exactly one location exists.
- **Pages:** native Sklad list (adjust quantities inline — native); custom read-only children:
  - **Nízký stav** (`/sklad-nizky-stav`): rows where `0 < available ≤ threshold`; columns Produkt/Varianta, Skladem, Rezervováno, Dostupné, threshold badge; row action „Upravit zásoby" → native inventory item.
  - **Vyprodáno** (`/sklad-vyprodano`): `available = 0` (excluding MTO-enabled variants and `manage_inventory=false`); action idem + „Skrýt z e-shopu?" hint linking product.
- **Thresholds:** global default **3 ks** in new `merchant-settings` key-value module (one table `merchant_setting(key unique, value jsonb)` — justified: no native app-settings store; also carries e-mail toggles §7, onboarding flags §19). Per-item override: native `inventory_item.metadata.low_stock_threshold` (no migration).
- **Notifications:** daily 07:00 Europe/Prague job computes both sets → feed bell + single digest e-mail „Skladové upozornění" (dedupe key `stock:{item_id}:{yyyy-mm-dd}` via native notification idempotency). Optional immediate sold-out ping on `InventoryLevelWorkflowEvents.UPDATED` (rank: high-value, not essential).
- **MTO exception:** MTO variants set `manage_inventory=false` (Phase 0 verify current state; P6 aligns) → excluded everywhere.
- **Bundles:** availability = min over component availability (existing presentation logic in [bundled-product/presentation.ts](backend/src/modules/bundled-product/presentation.ts)); shown read-only on bundle cards; never stored.
- **Reservations:** native page kept (Czech „Rezervace"); Denní práce never mentions reservations — they resolve inside native fulfilment ✅.

## 11. Bundles

Existing module/UX kept (composer, workflows with validation + title-sync hook, cart integration with per-item bundle metadata). Deltas only:

| Aspect | Spec |
| --- | --- |
| Modes | fixed variant / customer-selects ✅ (`variant_mode`); quantities + display order ✅ |
| Pricing | component_sum / component_sum_discount(%) / fixed_price ✅; card shows computed „Cena pro zákazníka: X Kč (součet Y − sleva Z)" preview (P7, read-only calc reuse) |
| Availability | min-of-components chip: „Dostupné: 4 (omezuje Miska modrá)" (P7) |
| Draft/published | = linked native product status; filter chips Vše/Koncepty/Publikované on the one page |
| Validation | publish blocked if: 0 items, missing fixed variant, discount outside 1–90 %, any component unpublished → Czech errors (extend existing validate step) |
| Storefront preview | „Zobrazit v e-shopu" link (storefront URL from env) |
| Order snapshot | components are real line items with prices at purchase ✅ — nothing to add; Denní práce groups visually (§5.2) |
| Stock | native via component items ✅ |

## 12. Reviews

One page `/reviews`, tabs = Czech statuses (default „Čekají na schválení"), existing DataTable + approve/reject bulk commands kept.

- Card/table: product (thumb+link), rating ★, name, date, content (clamped, expandable), customer badge „Ověřený nákup" when customer_id present.
- Actions: Schválit / Zamítnout (existing update-review workflow); confirm on reject: „Recenze se zákazníkovi nezobrazí. Pokračovat?".
- Moderation note: **skipped v1** (model has no column; not worth a migration — revisit only on demand).
- Merchant notif: feed „Nová recenze ke schválení ★{n} — {product}" (P2; emit in create-review workflow or subscriber on its event).
- Review-request e-mail: `order-review` template EXISTS — job: shipped ≥ 10 days ago (configurable `merchant-settings.review_request_days`), order not cancelled, dedupe `review-request:{order_id}` (native notification idempotency = audit + dedupe in one). No reminders v1 (one polite ask, rank: optional).
- Spam/duplicates: create-review workflow gains guard — reject 2nd review for same product+customer, and same-email>3/day; storefront shows Czech error.

## 13. Sale prices, promotions, seasonal selections

Four instruments, one explainer shown at the top of each related page (dismissible, stored in merchant-settings):

| Nástroj | Kdy použít (helper text verbatim) | Mění cenu? | Kde |
| --- | --- | --- | --- |
| **Sezónní výběr** | „Vánoční nebo jarní kolekce na úvodní stránce. Volitelně se slevou po dobu výběru." | volitelně (napojený ceník) | Sezónní výběry |
| **Akční ceník** | „Trvalejší zlevnění vybraných produktů (výprodej)." | ano | skryté Ceníky (advanced; via Sezónní výběry for normal use) |
| **Slevový kód** | „Kód, který zákazník zadá v košíku (SLEVA10)." | ano, po zadání | Propagace |
| **Automatická sleva** | „Sleva bez kódu, např. doprava zdarma nad 1 500 Kč." | ano, sama | Propagace |
| **Kampaň** | „Jen obálka pro více slev s rozpočtem — většinou nepotřebujete." | ne | Propagace → Kampaně |

**Sezónní výběry page (NEW UI; API/workflows exist — [manage-seasonal-selection.ts](backend/src/workflows/manage-seasonal-selection.ts), admin API `/admin/merchant-catalog/seasonal-selections`)**: tabs Naplánované/Aktivní/Archivované (from `publication_status` + dates); create wizard: 1) Název+handle+popis+fotky → 2) Produkty (picker, ordering) → 3) Termín od–do → 4) „Chcete slevu?" optional % → creates+links native price list with same dates → 5) Náhled → Naplánovat/Publikovat. Auto-archive job at `ends_at` (+ linked price-list end verified) — rank: essential. Overlap warning on publish: same product in another active selection-with-sale or active sale price list → modal listing conflicts „Produkt X už je ve slevě v …" (block only double-sale, warn otherwise).

Native Propagace/Kampaně pages untouched (+ helper widget on `promotion.list` with the explainer above).

## 14. Customers

Native list + native detail (Czech locale). Additions as widgets on `customer.details`:

- **Poslední objednávky** — native already shows orders; no work.
- **Recenze zákazníka** (count + link filtered by customer_id) — small widget (P10).
- **Oblíbené (wishlist)** — count via existing wishlist module links (P10, optional).
- **Poznámka** — editable note stored in native `customer.metadata.note` (native update API; no module).
- **Kontaktovat** — mailto button; **Znovu poslat ověřovací e-mail** — wraps existing resend-verification store route as admin action (P10).
- GDPR: no new PII copies (widgets read native data); existing storefront delete/restore-account flows remain the deletion path; admin adds nothing that outlives native records. Total spent: native order aggregation shown on native page — if absent in 2.18 UI, skip (not worth custom aggregation; Phase 0 visual check).

Customer groups: native, used only when she asks for wholesale pricing (out of v1 scope).

## 15. Merchant notifications

**Infrastructure (P2):** register `@medusajs/notification-local` provider with `channels: ["feed"]` in medusa-config (package installed, unused — verified). Bell then works natively (`/admin/notifications` API + drawer exist). E-mail channel: existing resend provider. Every notification = `createNotifications` with **idempotency_key** (native unique column) → dedupe + audit for free. Read/unread: native feed has no read-state → mitigation: bell shows newest-first with timestamps; urgent items ALSO e-mail. Retry: failed rows (status=failure) listed on `/prehled/emaily` with „Poslat znovu" → thin endpoint re-invoking provider with suffixed key (`:r2`).

| # | Notification | Trigger (event) | Channel | Urgency | Dedupe key | Native event? | Custom? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Nová zaplacená objednávka | order.placed (paid) | feed | info | `mn:new-order:{order}` | ✅ | subscriber |
| 2 | Platba selhala/expirovala | derived + P6 job | feed+email | urgent | `mn:payfail:{order}:{day}` | partial | job |
| 3 | Nové zadání zakázky | order.placed +MTO | feed | info | `mn:mto-new:{order}` | ✅ | subscriber |
| 4 | Zákazník čeká na odpověď | manual flag (internal note action) | — v1 | — | — | — | skip v1 |
| 5 | Blíží se termín výroby (−3 d) | daily job | feed | info | `mn:mto-due:{po}:{day}` | — | job |
| 6 | Termín výroby překročen | daily job | feed+email | urgent | `mn:mto-over:{po}:{day}` | — | job |
| 7 | Doplatek přijat | comgate reconcile | feed | info | `mn:balpaid:{req}` | via callback ✅ | subscriber |
| 8 | Doplatek po splatnosti (+7 d) | daily job | feed | info | `mn:baldue:{req}:{week}` | — | job |
| 9 | Objednávka připravena k odeslání | stage → shipping | feed | info | `mn:ready:{order}` | ✅ (C event exists: merchant-order.stage-changed) | subscriber |
| 10 | Vytvoření zásilky selhalo | ship workflow catch | feed+email | urgent | `mn:shipfail:{order}:{ts-hour}` | — | workflow step |
| 11 | Dopravce (API) nedostupný | provider error class | feed+email | urgent | `mn:carrier:{provider}:{hour}` | — | provider |
| 12 | Dochází: {produkt} | daily 07:00 | feed (+digest email) | info | `stock:{item}:{day}` | — | job |
| 13 | Vyprodáno: {produkt} | level=0 event/job | feed (+digest) | urgent | `stock0:{item}:{day}` | ✅ level event | subscriber |
| 14 | Recenze ke schválení | review created | feed | info | `mn:review:{review}` | C event | workflow |
| 15 | E-mail se nepodařilo odeslat | notification status failure | feed | urgent | `mn:emailfail:{notif}` | ✅ native status | poller (P2 job 15 min) |
| 16 | Sezónní výběr začíná za 3 dny | daily job | feed | info | `mn:season:{sel}:{day}` | — | job |
| 17 | Akce/sleva končí za 3 dny | daily job | feed | info | `mn:saleend:{pl}:{day}` | native data | job |
| — | Denní souhrn (07:05) | daily job | email | info | `mn:digest:{day}` | — | job + 1 NEW template `merchant-daily-summary` |

**Recipient routing (D7):** two envs replace the single address. Business events (#1, #2, #3, #7, #8, #9, #12, #13, #14, #16, #17) → `OWNER_NOTIFICATION_EMAIL`; technical failures (#10, #11, #15) → `DEV_NOTIFICATION_EMAIL`. Urgent = feed **and** immediate e-mail to the routed address. Empty env ⇒ skip that e-mail with a logged warning (never crash). **Daily digest (07:05) → BOTH addresses**, content per D7: denní tržby (Kč, zaplacené objednávky) + počet nedokončených objednávek (koncepty + opuštěné košíky) + odkaz na Přehled — deliberately not an order-count report. Browser push: **not recommended** (service-worker infra disproportionate; digest+bell suffice).

Per-event owner e-mails (D7): #1 „Nová zaplacená objednávka" and #7 „Doplatek přijat" send an e-mail to OWNER in addition to the bell — she works from her inbox.

## 16. Customer e-mail lifecycle

**Ground truth:** templates in `src/modules/resend/emails/` (34, Czech). Wired today: order-placed ✅, abandoned-cart ✅ (job), restock ✅ (job), email-verification/password-reset/user-invited ✅. **Everything else exists as a template but is never sent.** The resend provider maps `template` name → component; sending = `createNotifications({channel:'email', template, data, idempotency_key})` from subscribers/jobs — audit + dedupe native.

| # | E-mail (template file) | Trigger | Stav | Předmět (CZ) | CTA | Idempotency key | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | order-placed ✅ | order.placed | **wired** | Potvrzení objednávky #{id} | Zobrazit objednávku | native (exists) | keep |
| 2 | payment-received | payment.captured | template only | Platba přijata — děkujeme | — | `payment-received:{order}` | skip when capture ≈ placed (<5 min) to avoid double-mail with #1 (flag in subscriber) |
| 3 | payment-failed | callback cancelled / P6 expiry | template only | Platba se nezdařila | Zaplatit znovu (link) | `payfail:{order}:{attempt}` | includes new ComGate link |
| 4 | payment-pending | balance requested / manual link | template only | Odkaz k platbě objednávky #{id} | Zaplatit {X} Kč | `paylink:{collection}` | **fixes dead event** made-to-order.balance-requested |
| 5 | payment-cancelled | payment canceled | template only | Platba zrušena | — | `paycancel:{payment}` | only when order continues COD/other |
| 6 | order-processing | MTO spec confirmed | template only (reword) | Zadání potvrzeno — začínáme | — | `spec-ok:{po}` | NOT sent for normal orders (noise rule) |
| 7 | (production started) | MTO start | — | Výroba začala | — | `prod-start:{po}` | optional toggle, default OFF (merchant-settings) |
| 8 | order-delayed | manual button | template only | Výroba se protáhne | — | `delay:{po}:{n}` | manual-only, never automatic |
| 9 | payment-pending (reuse) | balance reminder — **manual click only (D4)** | — | Připomínka doplatku | Zaplatit | `balremind:{req}:{n}` | never automatic; overdue badge prompts her |
| 10 | payment-received (reuse) | balance paid | template only | Doplatek přijat | — | `balpaid:{req}` | |
| 11 | order-shipment | shipment.created | template only | Objednávka odeslána 📦 | Sledovat zásilku | `ship:{fulfillment}` | tracking from fulfilment labels (P4-2, Balíkovna/ČP tracking URL); no tracking → e-mail sent without CTA, never a fake link |
| 12 | order-ready-pickup | carrier "ready" webhook | template only | Zásilka připravena k vyzvednutí | Kde vyzvednout | `pickup:{fulfillment}` | **v2 only** (needs Packeta webhook; do NOT fake from shipment) |
| 13 | order-delivered | markAsDelivered | template only | Zásilka doručena | — | `delivered:{fulfillment}` | only when she clicks delivered / future webhook |
| 14 | order-review | job +10 d po odeslání | template only | Jak se vám líbí nový kousek? | Napsat recenzi | `review-request:{order}` | §12 rules |
| 15 | order-cancelled | order.canceled | template only | Objednávka zrušena | — | `cancel:{order}` | |
| 16 | payment-refunded | payment.refunded | template only | Vracíme peníze | — | `refund:{payment}` | „refund started" and „completed" collapsed — ComGate refunds are single-step; two mails would lie |
| 17 | order-refunded | order fully refunded | template only | Objednávka vrácena | — | `orefund:{order}` | only on full refund |
| 18 | delivery-failed | carrier exception | — | Problém s doručením | Kontaktujte nás | manual | manual-send from card v1 |
| 19–25 | auth/account set ✅ (verification, reset, changes, deletion) | various | **wired/partial** | — | — | native | keep as-is |
| 26 | abandoned-cart ✅ / restock ✅ / newsletter / price-drop / promotional / bundle-published / welcome | jobs/manual | mixed | — | — | — | out of v1 scope except keeping current jobs |

**Never automatic:** order-delayed, delivery-failed, promotional/newsletter, price-drop, „being prepared" for normal orders, anything „delivered" without a real signal. **Resend rules:** every sent e-mail row visible (native notifications, filter by `resource_id=order_id`) in an order-page widget „Odeslané e-maily" (P5) with per-row „Poslat znovu" (suffixed key, confirm dialog). Failure handling: provider failure ⇒ notification status failure ⇒ merchant notif #15.

## 17. Plain-language terminology guide

| Technický pojem | Klientský název | Vysvětlení (tooltip/helper) | Kde se vysvětluje | Skrýt technický pojem? |
| --- | --- | --- | --- | --- |
| fulfillment | Zásilka / Připravit k odeslání | „Záznam o zabalené zásilce. Připraví položky k odeslání." | K odeslání, order widget | ano |
| shipment | Odeslání | „Zásilka předaná dopravci." | tamtéž | ano |
| payment collection | Platba / Požadavek na platbu | „Kolik má být zaplaceno a co už přišlo." | order page (native cs) | ano (jen badge) |
| capture | Přijetí platby | „Peníze skutečně dorazily." | payment badge tooltip | ano |
| refund | Vrácení peněz | „Odeslání peněz zpět zákazníkovi." | native (cs) | ne (pojem OK) |
| draft order | Koncept objednávky | „Ručně založená objednávka (telefon, trh)." | Koncepty page header | ne — native cs už správně |
| reservation | Rezervace zboží | „Kusy odložené pro zaplacené objednávky. Řeší se samy." | Sklad helper | ano (stránka zůstává) |
| inventory item / level | Skladová položka / Skladem | „Počet kusů na dílně." | Sklad | ano |
| stock location | — | (jediná dílna — nikdy nezobrazovat) | — | ano, úplně |
| price list | Akční ceník | „Dočasné jiné ceny pro vybrané produkty." | Sezónní výběry wizard | ano (skrytá sekce) |
| promotion | Sleva / Slevový kód | viz §13 tabulka | Propagace helper | ne |
| campaign | Kampaň | „Obálka pro více slev s rozpočtem." | tamtéž | ne |
| variant | Varianta | „Provedení produktu (barva, velikost)." | product editor helper | ne |
| provider session / transaction id | — | nikdy nezobrazovat (jen v technickém detailu) | — | ano |
| metadata | — | nikdy | — | ano |
| workflow / event | — | nikdy | — | ano |

Rule: technical IDs (`order_…`, `ful_…`, `payses_…`) never appear on custom pages — only `#display_id`, names and Czech badges. Native detail pages keep them (rule 8 escape hatch).

---

## 18. Error prevention and safety

| Risk | Prevention (UI) | Backend validation (authoritative) | Recovery | Audit |
| --- | --- | --- | --- | --- |
| Duplicate button clicks | `isPending` disable ✅ everywhere | transition lock ✅; ship-workflow lock (P3); idempotent steps ✅ | retry safe by design | workflow executions |
| Duplicate e-mails | resend = explicit confirm | native notification `idempotency_key` unique | suffixed manual resend | notification table |
| Duplicate fulfilments | one action per card | ship workflow reuses open fulfilment ✅; middleware guard (P4) | cancel fulfilment (native) → auto stage back ✅ | order timeline |
| Duplicate payment links | — | open-collection reuse ✅ + request idempotency ✅ | send same link again | payment_requests |
| Wrong stage jump | only next-action shown | `MERCHANT_ORDER_STAGE_TRANSITIONS` guard ✅ (+`reconcile` for facts ✅) | reconcile subscribers ✅ | stage_changed_by/at ✅ |
| Ship before full payment | button hidden + reason line | **numerical gate (A2)**: captured−refunded ≥ payable ± ε ∧ pending_difference ≤ ε ∧ no order edit ∧ no open collection — in ship workflow + native-route middleware (P3/P4) | pay → auto-unlock ✅ | payment requests |
| Premature „odesláno" without carrier handover | card shows „Čeká na ruční podání zásilky." + explicit confirm (§5.4) | shipment/e-mail/stage produced only by real `createOrderShipmentWorkflow` (A1) | confirm handover when done | fulfilment vs shipment timestamps |
| Missing MTO specification | „Nové zadání" section blocks confirm without read | requireStage ✅; spec text shown in confirm dialog | contact customer | production_order |
| Bundle component unavailable | availability chip + publish validation | extend validate-bundle step (P7) | unpublish bundle | — |
| Missing pickup point | card warning ⚠ | ship gate (P4) | „Kontaktovat zákazníka" | — |
| Expired payment | — | P6 reconciliation job (ComGate status poll, `last_checked_at`) | „Poslat platební odkaz" (new session) | requests + notif |
| Carrier API failure | row failure badge + retry | provider errors mapped; stage unchanged ✅ | retry idempotent; orphan-packet runbook (P4 doc: check Packeta by order number before manual retry) | feed notif + logs |
| Stale queue data | 30 s refetch + focus refetch (P3) | server state always re-read in workflows ✅ | — | — |
| Accidental publish | completeness confirm dialog (§8.2) | native validation | unpublish | — |
| Deleting referenced data | native constraints; UI hides delete where linked (bundle products: existing delete flow cleans links ✅) | native + link cleanup workflows ✅ | — | — |
| Conflicting promotions/sales | overlap check on publish (§13) | same check server-side (P9) | edit dates | — |
| Invalid production dates | date pickers min=today; min≤max | zod on routes (P6) | edit | — |
| Historical orders missing from queues | Přehled/queue banner | idempotent backfill endpoint (P3) | run backfill | backfill log line |

## 19. Empty states, help text, onboarding

First-use helper cards (dismissible; dismissal stored in `merchant-settings.onboarding.{page}`) on: Přehled, each Denní práce stage, Zakázky, Nízký stav, Sezónní výběry, Balíčky, Recenze.

| Page | Empty-state title | Text | Action |
| --- | --- | --- | --- |
| Přehled (all clear) | Dnes nic nehoří 🎉 | „Nové objednávky se tu objeví samy." | — |
| Nové | V tomto kroku nic nečeká ✅ | „Jakmile přijde zaplacená objednávka, uvidíte ji tady." | — |
| K odeslání | Vše odesláno | „Připravené objednávky sem přesunete tlačítkem v kroku Připravujeme." | → Připravujeme |
| Problém s platbou | Žádné problémy s platbou | „Sem spadnou objednávky, u kterých platba neprošla. Většinou se vyřeší samy." | — |
| Zakázky | Žádná zakázka | „Zakázka vznikne, když si zákazník objedná produkt označený ‚Na zakázku'." | → Produkty na zakázku |
| Nízký stav | Zásoby jsou v pořádku | „Upozorníme vás, když něčeho zbudou ≤ {n} kusy." | Upravit hranici |
| Vyprodáno | Nic není vyprodané | — | — |
| Recenze | Žádné recenze nečekají | „Po doručení objednávky zákazníky sami poprosíme o recenzi." | — |
| Sezónní výběry | Zatím žádný výběr | „Vytvořte např. ‚Vánoční kolekci' — vyberete produkty, termín a volitelně slevu." | + Nový výběr |
| Balíčky | Zatím žádný balíček | „Balíček spojí více produktů do jedné nabídky (např. čajová souprava)." | + Nový balíček |

Dangerous-action confirms (pattern: consequence first, verb-specific button): Zrušit objednávku → „Objednávka #1042 se zruší a rezervované kusy se vrátí do skladu.{ Zaplacených X Kč — vraťte v detailu objednávky.}" [Zrušit objednávku / Zpět]; Zamítnout recenzi; Publikovat nekompletní produkt; Uložit pro všechny (native layout dialog exists ✅); Smazat balíček → „Produkt balíčku se smaže z e-shopu. Objednávek se to nedotkne."

Inline helpers: every custom form field ships a one-line Czech helper (already specified in §7–§13 verbatim); no developer words anywhere (checked against §17 banlist in P11 review).

## 20. Automation opportunities

| Automation | Rank | Trigger → Action | N/C | Failure behavior | Override | Audit |
| --- | --- | --- | --- | --- | --- | --- |
| Classify paid orders into queues | **essential** ✅ done | order.placed → stage by payment | C | subscriber retry (at-least-once ✅ idempotent) | manual transition | state row |
| Auto-move on fulfilment/shipment/cancel | **essential** ✅ done | native events → reconcile | C | idempotent | reconcile:true path | stage fields |
| Auto-flag payment failures | **essential** (partial ✅ + P6 expiry) | derived + poll → Problém | C | job rerun | manual link | requests |
| Auto payment-problem release | **essential** ✅ done | payment.captured → Nové | C | idempotent | — | ✅ |
| Order confirmation e-mail | **essential** ✅ done | order.placed | C+N | notif failure surfaced | resend | notif table |
| Shipment e-mail w/ tracking | **essential** (P5) | shipment.created | N event | status failure → #15 | resend | notif |
| Balance-request e-mail | **essential** (P5 — fixes dead event) | balance-requested | C event | idem | resend | notif |
| Ship lock until fully paid | **essential** (P3) | gate in workflow+middleware | C | reject w/ Czech reason | none (deliberate) | rejection log |
| Outstanding balance auto-calc | **essential** ✅ done | server-side | C | — | — | ✅ |
| Low-stock/sold-out alerts | **high-value** (P7) | daily job + level event | C | next run | threshold per item | notif keys |
| Review request after shipping | **high-value** (P6/P9) | +10 d job | C | next run | disable in settings | `review-request:{order}` |
| Auto-archive seasonal/sales | **high-value** (P9) | ends_at job | C | next run | manual archive | status history |
| Daily merchant digest | **high-value** (P2) | 07:05 job | C | failure notif | disable | notif |
| Auto Czech variant names | **optional** (option-value join exists natively; low pain) | — | — | — | — | — |
| Auto „delivered" without carrier signal | **unsafe — rejected** (would lie to customers) | — | — | — | — | — |
| Auto-cancel unpaid orders after N days | **rejected — decided D6** (notify only, cancel is always her click) | — | — | — | — | — |
| Automatic balance reminder | **rejected — decided D4** (manual „Připomenout" only) | — | — | — | — | — |
| Auto-refund on cancel | **unsafe — rejected** (money moves only on explicit click) | — | — | — | — | — |

## 21. Feature inventory

E=essential O=optional · ✅=exists · S/M/L complexity · P1(=must)–P3 priority.

| Area | Feature | E/O | Native | Existing C | New C | Benefit | Cx | Pri | Deps | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation | Czech admin locale for user | E | ✅ | — | config/doc | terminology | S | P1 | — | none |
| Foundation | Sidebar default layout (order+hide) | E | ✅ | payload doc ✅ | apply | orientation | S | P1 | P1-nav | low |
| Foundation | feed provider registration | E | ✅ pkg | — | config | bell works | S | P1 | — | none |
| Foundation | merchant-settings accessor (A3, allowlisted) | E | store.metadata candidate | — | accessor (+table only on blocker) | thresholds/toggles | S | P1 | — | low |
| Nav | Zakázková výroba top-level + children | E | — | page ✅ | move+queue | one workspace | M | P1 | — | URL move |
| Nav | Sklad children (2 pages) | E | data ✅ | — | pages | restock clarity | M | P2 | P7 job | low |
| Dashboard | /prehled + summary endpoint | E | partial | counts ✅ | endpoint+page | „co teď" | M | P1 | P2 | low |
| Dashboard | Na řadě list | O | — | card ✅ | reuse | focus | S | P2 | — | — |
| Denní práce | queues+actions+sync | E | ✅ | ✅ done | — | core | — | — | — | — |
| Denní práce | pagination, refetch, backfill, cancel-sub | E | ✅ | partial | small | correctness | S | P1 | — | low |
| Denní práce | ship gating (pay/MTO/pickup) | E | middleware | gate new | new | safety | M | P1 | — | COD Q |
| Shipping | ČP provider minimal impl | E | iface | stub | impl | unblocks ship | S | P1 | — | none |
| Shipping | Packeta fixes (COD, weight, value, labels/tracking, errors) | E | — | ✅ buggy | fix | correct packets | M | P1 | Packeta docs | **high** |
| Shipping | Balíkovna/ČP real API | O | — | — | L | labels | L | P3 | credentials | high |
| Emails | wire 12 lifecycle sends | E | events | templates ✅ | subscribers | customer trust | M | P1 | P2 infra | low |
| Emails | order „Odeslané e-maily" widget + resend | E | notif ✅ | — | widget+endpoint | traceability | M | P2 | P5 | low |
| Emails | digest template | O | — | — | 1 template | overview | S | P2 | — | — |
| Notifications | 17 merchant notifs | E | infra ✅ | — | subs+jobs | awareness | M | P1–2 | P2 | low |
| MTO | Zakázky queue UI | E | — | API ✅ | page | production control | M | P1 | — | low |
| MTO | expiry/poll job | E | — | fields ✅ | job | stuck payments | M | P2 | ComGate status API ✅ (`retrieveDetails` exists) | low |
| MTO | deadline warnings | E | — | field ✅ | job | promises kept | S | P2 | — | — |
| MTO | price≥deposit validation | E | — | — | check | refund mess avoided | S | P1 | — | — |
| Inventory | thresholds+alerts | E | data ✅ | — | job+pages | no stockouts | M | P2 | settings | low |
| Bundles | availability+price preview+validation | E | — | ✅ core | small | fewer mistakes | S–M | P2 | — | low |
| Products | launcher templates (4) | O(high) | API ✅ | — | page | faster listing | M | P2 | — | low |
| Products | completeness widget | E | zone ✅ | — | widget | fewer broken listings | S | P2 | — | — |
| Catalog | composed page keeps CRUD+presentation | E | ✅ | ✅ | polish | one path | S | P2 | — | — |
| Catalog | unclassified warning | O | query | — | banner | findability | S | P3 | — | — |
| Seasonal | admin UI + wizard + jobs | E | price lists ✅ | API ✅ | page+jobs | seasonal sales | M–L | P2 | — | medium |
| Reviews | tabs+notify+request-email | E | — | ✅ core | wire | social proof | S–M | P2 | P5 | low |
| Reviews | duplicate/spam guard | E | — | workflow ✅ | check | integrity | S | P2 | — | — |
| Customers | widgets (note, reviews, resend-verify, wishlist) | O | ✅ detail | modules ✅ | widgets | context | S–M | P3 | — | low |
| Safety | §18 full matrix | E | mixed | partial | rest | trust | M | P1–2 | — | — |
| QA | terminology+empty-states pass | E | — | — | review | usability | M | P2 | all | — |
| Ops | backfill+reconcile+layout apply+smoke | E | — | scripts | run | go-live | M | P1 | all | medium |

## 22. Proposed page specifications

Native pages used as-is (Objednávky, order detail, Koncepty, Produkty list/detail, Možnosti, Sklad, Rezervace, Propagace, Kampaně, Zákazníci, Skupiny, Nastavení, skryté Ceníky/Kolekce/Kategorie): **no spec — untouched**, plus widgets noted in §8/§14/§13.

Format: Route · Purpose · Data · Header · Filters · Rows/cards · Primary / Secondary · Warnings · Empty/Loading/Error · API · Workflows · Tests.

**/prehled** · answer „co teď" · `GET /admin/operations/summary` (new, C) · header: date + „Obnovit" · no filters · tiles per §4 + Na řadě cards · primary = per-tile CTA · warnings zone 1 · empty §19 · skeleton tiles · error: „Přehled se nepodařilo načíst" + retry · API: summary · WF: none (read) · tests: summary unit (counts per fixture), tile render.

**/denni-prace** (overview) ✅ exists · add: reconciliation banner, Na řadě reuse. **/denni-prace/{nove|pripravujeme|k-odeslani|odeslano|problem-s-platbou}** ✅ exist · deltas §5.3: pager (50), refetch 30 s, card additions (§5.2), failure badges, gating reasons · API existing merchant-orders (+`GET backfill-status`, `POST backfill`) · WF: ship gate ext. · tests: gating matrix (paid/unpaid/MTO/pickup), transition rejections, backfill idempotency.

**/zakazkova-vyroba/zakazky** · production queue · `GET /admin/made-to-order/orders?stage=…` (extend existing list route) · header: counts per stage chips · sections stacked: Nové zadání / Ve výrobě / Čeká na doplatek / Připraveno k odeslání / Dokončené (60 d) · card: #id, customer, spec excerpt, agreed vs paid Kč bar, deadline chip, ONE stage action (labels §7.2) · secondary: Otevřít objednávku, Kontaktovat, Zrušit zakázku · warnings: overdue, balance overdue · empty §19 · API: existing actions route ✅ + list ext. · WF: existing + P6 validations · tests: action-per-stage authz, price≥deposit, outstanding math.

**/zakazkova-vyroba/produkty** · profile manager · existing page moved · add variant-override drawer polish + helpers · tests: profile CRUD.

**/sklad-nizky-stav**, **/sklad-vyprodano** · restock decisions · new `GET /admin/inventory-alerts?type=low|out` (C read: query.graph inventory_levels+variant+product, threshold merge) · rows: product/variant, Dostupné/Skladem/Rezervováno, threshold badge · primary: Upravit zásoby → native item · header: „Hranice upozornění: {n} — Změnit" (settings drawer) · tests: threshold merge (global vs metadata), MTO exclusion.

**/reviews** ✅ · deltas: tabs by Czech status (default pending), verified-purchase badge, reject confirm · tests: status transitions, spam guard.

**/sezonni-vybery** · seasonal curation · existing API · tabs by status · wizard §13 (5 steps) · list card: title, dates, product count, sale % chip, status · primary per status: Publikovat / Ukončit / Obnovit · warnings: overlap modal · API existing + `POST …/publish` validation ext. · WF: manage-seasonal-selection ✅ + archive job · tests: date validation, price-list linkage, overlap detection, archive job.

**/bundled-products** ✅ · deltas §11 (availability chip, price preview, filter chips, publish validation) · tests: validation matrix, availability calc.

**/prehled/emaily** (route under Přehled, no sidebar item) · failed + recent notifications · native `GET /admin/notifications` filtered · rows: čas, komu, předmět/šablona, stav badge · action: Poslat znovu (confirm) · API: native list + new `POST /admin/notifications/:id/retry` · tests: retry idempotency (new key), authz.

Widgets (zones verified in installed `admin-shared`): order detail „Denní práce" ✅, „Zakázková výroba" ✅, NEW „Odeslané e-maily" (order.details.after); product „Než publikujete" + „Na zakázku" (product.details.side); customer note/reviews/verify (customer.details.side); promotion helper (promotion.list).

## 23. Final visual layout (hierarchy wireframes)

```
SIDEBAR (§2.2 order)                 TOP BAR
┌───────────────┐   ┌────────────────────────────────────────────────┐
│ Keramická z.  │   │ ◧  Breadcrumbs…            [⚙customize] [🔔3]  │
│ 🔍 Hledat  ⌘K │   └────────────────────────────────────────────────┘
│ ▸ Přehled     │   🔔 drawer: „Platba u #1042 selhala · před 5 min"
│ ▸ Denní práce │           „Dochází: Miska modrá (2 ks) · 07:00"
│ ▸ Objednávky  │           [starší…]
│ ▸ Zakázková v.│
│ ▸ Sklad       │
│ ▸ Produkty    │
│ ▸ Recenze     │
│ ▸ Sezónní výb.│
│ ▸ Propagace   │
│ ▸ Zákazníci   │
│ ⚙ Nastavení   │
└───────────────┘

PŘEHLED
┌ Vyžaduje pozornost ──────────────────────────────────────────────┐
│ [❗2 Problémy s platbou → Vyřešit]  [❗1 E-mail neodešel → Znovu] │
└──────────────────────────────────────────────────────────────────┘
┌ Dnešní práce ────────────────────────────────────────────────────┐
│ [3 Nové → Začít] [2 Připravujeme] [1 K odeslání] [1 Doplatek 2 400 Kč] [2 Ve výrobě ⏰15.8.] │
└──────────────────────────────────────────────────────────────────┘
┌ Obchod ──────────────────────────────────────────────────────────┐
│ [Dochází: 3] [Vyprodáno: 1] [Recenze: 2] [Končí: Jarní sleva za 3 d] │
└──────────────────────────────────────────────────────────────────┘
Na řadě ────────────────────────────────────────────────────────────
  (order card ×≤5, §5.2 layout, inline action)

DENNÍ PRÁCE / K ODESLÁNÍ = header (title+desc) → banner? → card list → pager
ORDER CARD = §5.2 block
ZAKÁZKY = stacked stage sections, each: „■ Čeká na doplatek (1) — [card: #1038 · Váza XL ·
  zaplaceno 1 500 / 6 000 Kč ▓▓░░ · [Připomenout doplatek]]"
NÍZKÝ STAV = table rows + „Hranice: 3 ks — Změnit"
RECENZE = tabs → row: ★★★★☆ „Krásný hrnek…" — Jana N. — Hrnek modrý — [Schválit][Zamítnout]
NOTIFIKACE = bell drawer above
```

## 24. Implementation roadmap

Rules: one phase = deployable increment; **gate after every task**: `pnpm typecheck` + `medusa build` (backend+admin) green; phase end: deploy to Railway, run listed smoke checks. Rollback default: revert commit + redeploy (no destructive migrations exist in plan; the single new table is additive). Task format: **ID · goal** — deps — files — native used — custom — migrations — tests — accept.

### Phase 0 — verification & constraints (no code)
- **P0-1 · Runtime facts.** — — read-only admin API against Railway: list stock locations (expect 1), shipping options ↔ provider ids, whether COD option exists, sample MTO variant `manage_inventory` — accept: findings appended to this file §0-notes.
- **P0-2 · Locale.** Set client user language to Czech; visually verify sidebar/domains + draft-order plugin label fallback — accept: screenshot note; open i18n gap list.
- **P0-3 · Env inventory.** Create `DEV_NOTIFICATION_EMAIL` + `OWNER_NOTIFICATION_EMAIL` (empty allowed — skip-with-warning semantics, D7) and `BALIKOVNA_API_*` placeholders (D8); document Railway service/env mapping — accept: env doc committed (no secrets).
- **P0-4 · Business decisions** — ✅ RESOLVED as D1–D8 (§26). Remaining in this task: count unshipped orders with Packeta shipping methods (feeds P4-5).

### Phase 1 — foundations & navigation
- **P1-1 · merchant-settings accessor (A3).** — P0 — `src/lib/merchant-settings.ts`: zod schema with the **closed allowlist** (A3 keys only), typed get/set — storage decision inside the task: **first** evaluate `store.metadata.merchant_settings` via native `updateStoresWorkflow` (preferred: zero migrations); build `src/modules/merchant-settings/` (1 table) **only** on a concrete blocker, documented in the accessor header — prohibited content per A3 — unit: schema rejects unknown keys; get/set round-trip — accept: seeded defaults readable through the accessor; call sites storage-agnostic.
- **P1-2 · Move MTO section.** — — `src/admin/routes/zakazkova-vyroba/{page,produkty/page}.tsx` (+ redirect stub at old `/made-to-order` without config, pattern of merchant-orders redirect ✅) — accept: sidebar shows section+children; old URL redirects.
- **P1-3 · Sklad child stubs + reviews tabs shell + sezonni-vybery shell.** — — routes per §22 — accept: pages render empty states §19.
- **P1-4 · Sidebar default layout apply.** — P1-2/3 — extend [set-sidebar-order.md](backend/scripts/set-sidebar-order.md) payload with new ids + hidden rows; apply via UI („Default view") on staging then prod — accept: order matches §2.2 for a second admin user.

### Phase 2 — notifications & aggregation
- **P2-1 · feed provider.** — — medusa-config: add `@medusajs/notification-local`, channels `["feed"]` — accept: manual `createNotifications` appears in bell.
- **P2-2 · notify helper + first 5 subscribers** (new-paid-order, MTO-new, ready-to-ship, balance-paid, review-created hookup point). — P2-1 — `src/lib/notify.ts`, `src/subscribers/merchant-notifications.ts` — native createNotifications w/ idempotency — tests: dedupe on re-emit — accept: events → bell exactly once.
- **P2-3 · operations summary endpoint + /prehled page.** — P2-1 — `src/api/admin/operations/summary/route.ts`, `src/admin/routes/prehled/page.tsx` — query.graph + module counts (indexed `listAndCount` pattern ✅) — tests: fixture counts — accept: §4 tiles live.
- **P2-4 · email-failure poller (15 min) + /prehled/emaily + retry endpoint.** — P2-1 — job + route + page — native notifications list — tests: retry creates new key — accept: forced failure visible & resendable.
- **P2-5 · daily digest 07:05 + template `merchant-daily-summary`.** — P2-3 — job + 1 new email — accept: digest e-mail with §4 numbers.

### Phase 3 — Denní práce stabilization
- **P3-1 · order.canceled → stage cancelled.** — — reconcile subscriber ✅ extend — tests: cancel → hidden from queues — accept ✓.
- **P3-2 · Pagination + refetch.** — — queue component ✅ — accept: 120-order fixture pages at 50; data refreshes ≤30 s.
- **P3-3 · Backfill status/banner/endpoint.** — — merchant-orders routes + queue banner — `initialStageForPayment` ✅ — tests: idempotent double-run — accept: legacy orders enter queues once.
- **P3-4 · Ship gate step — numerical invariant (A2).** Gate = (captured − refunded ≥ payable total ± ε) ∧ (`summary.pending_difference ≤ ε`) ∧ (no active `order_change`) ∧ (no open payment collection awaiting money) ∧ (MTO: outstanding = 0). No COD exists (D1). — — [ship-merchant-order.ts](backend/src/workflows/ship-merchant-order.ts) + projection reason field — tests: matrix §22 **plus**: order edited up after capture is blocked; deposit-only capture blocked; refund-then-reship blocked — accept: AC-3 provable numerically.
- **P3-5 · Ship-workflow lock + failure feed notif (#10).** — P2-2 — same file — accept: double-fire → one shipment.

### Phase 4 — carriers (REWRITTEN per D8: Packeta out, Balíkovna B2B in)
- **P4-1 · Balíkovna provider skeleton + two-phase dispatch (A1/§5.4).** — P0-1 — new `src/modules/balikovnaFulfillment/` (replaces the ČP stub; keep identifier compatible with existing shipping options per P0-1 findings, else migrate options) — AbstractFulfillmentProviderService — `createFulfillment`: creds absent → record-only `{data:{mode:"manual"}, labels:[]}`; creds present → `{data:{mode:"api",…}}` — **plus** ship-workflow branch (stop before shipment in manual mode), derived blocking badge, `confirmMerchantHandoverWorkflow` + endpoint + card action per §5.4 — tests: manual mode creates NO shipment/e-mail/stage-change; handover confirm idempotent; api mode single-click — accept: manual-mode order stays in K odeslání as „Čeká na ruční podání zásilky." until confirmed; `shipped` only ever via real shipment workflow.
- **P4-2 · Balíkovna B2B API integration.** — P4-1, creds from Matěj — implement packet creation + label (e-mail/PDF per D2) + tracking number from official ČP/Balíkovna B2B docs (verify endpoints/units there — do not guess); `cod` always 0 (D1); weight Σ variant weights, fallback `default_parcel_weight_kg` (D2); errors → Czech messages routed to DEV e-mail (D7); orphan-packet runbook — tests: request-builder unit, error mapping — accept: staging packet visible in Balíkovna portal; tracking lands on shipment + e-mail #11.
- **P4-3 · Pickup-point gate + card line.** — P3-4 — gate + projection read Balíkovna pickup point (storefront picker is a flagged external dependency — until it exists, Balíkovna options are address-delivery only) — accept: pickup-type order without point blocked with Czech reason.
- **P4-4 · Native-route middleware guard** (same rules as P3-4 on `POST /admin/orders/:id/fulfillments`). — P3-4 — `src/api/middlewares.ts` — tests: direct API blocked — accept: no bypass via native page.
- **P4-5 · Packeta decommission.** — P0-1 count — if unshipped Packeta orders = 0: leave provider dormant, delete its planned fixes from scope; else ship them manually first (runbook line). Matěj removes shipping options in admin (his task, tracked here for sequencing) — accept: no active order references a Packeta option before options removal.

### Phase 5 — customer e-mail lifecycle
- **P5-1 · Send helper + wiring batch A** (#2,3,4,10,11 of §16): payment-received, payment-failed, payment-pending/balance (subscribes the **dead event**), balance-paid, order-shipment. — P2 — `src/subscribers/customer-emails.ts` — tests: idempotency keys, skip-rule #2 — accept: staging flow produces exact mail set, no dupes on re-emit.
- **P5-2 · Batch B** (#6 spec-approved, #15 cancel, #16/17 refund). — P5-1 — accept ✓.
- **P5-3 · „Odeslané e-maily" order widget + resend.** — P2-4 — widget (order.details.after) — accept: AC-6 provable per order.
- **P5-4 · Template copy pass** (subjects §16, data completeness: totals via native calc ✅, tracking, pickup variant). — accept: rendered previews approved by user.

### Phase 6 — made-to-order completion
- **P6-1 · Zakázky queue page.** — P1-2 — §22 spec; extend list route with stage filter — tests: per-stage action authz — accept: full 3.2 flow driven from one page.
- **P6-2 · price≥deposit validation + date validation.** — — actions route — tests ✓.
- **P6-3 · ComGate reconciliation job** (30 min; pending/sent requests → `retrieveDetails` ✅ provider method; expired → state + notif #2/#8; paid-missed → reconcile paid path ✅). — P2-2 — job — tests: state transitions from mocked statuses — accept: stuck payment self-heals ≤30 min.
- **P6-4 · Deadline job (−3 d, overdue) + Přehled tile hookup.** — P2-3 — accept ✓.
- **P6-5 · „Připomenout doplatek" manual resend + overdue badge (+7 d).** No automatic reminder (D4 — the flow is deliberately manual; system only notifies her). — P5-1 — accept: resend idempotent, badge appears, nothing fires unattended.
- **P6-6 · MTO inventory alignment** (per P0-1: set `manage_inventory=false` on MTO variants via script). — accept: MTO excluded from stock alerts.

### Phase 7 — inventory & bundles
- **P7-1 · inventory-alerts endpoint + both pages live.** — P1-1 — threshold merge logic — tests: merge + exclusions — accept §22.
- **P7-2 · stock jobs + notifs (#12/13) + digest hookup.** — P2 — accept: crossing threshold pings once/day.
- **P7-3 · Bundle polish** (availability chip, price preview, publish validation, filter chips, queue-card grouping). — — existing components — tests: validation matrix — accept ✓.

### Phase 8 — products & catalog
- **P8-1 · Launcher (4 templates via native API create).** — — `src/admin/routes/novy-produkt/page.tsx` or header action — tests: created product shape — accept: unique piece live in ≤2 min flow.
- **P8-2 · Completeness widget + publish confirm.** — — product.details widget — accept ✓.
- **P8-3 · MTO product widget.** — P1-2 — accept ✓.
- **P8-4 · Catalog polish** (tree link, unclassified banner, helper texts). — accept ✓.

### Phase 9 — reviews, seasonal, sales
- **P9-1 · Reviews tabs final + spam guard + reject confirm + notif #14.** — P2-2 — tests: guard — accept ✓.
- **P9-2 · Review-request job.** — P5-1 — accept: key `review-request:{order}` unique.
- **P9-3 · Seasonal wizard + publish validation + overlap check.** — P1-3 — existing workflows — tests: linkage + overlap — accept: full §13 flow.
- **P9-4 · Auto-archive + ending-soon notifs (#16/17).** — P2 — accept ✓.

### Phase 10 — customers
- **P10-1 · Customer widgets** (note→metadata, reviews count, resend-verify; wishlist optional). — — widgets — accept ✓.

### Phase 11 — QA, terminology, onboarding
- **P11-1 · Terminology sweep** (§17 banlist grep over `src/admin` strings) — accept: zero banned terms user-visible.
- **P11-2 · Empty/error/loading states audit per §19/§22; helper cards + dismissal.** — P1-1 — accept ✓.
- **P11-3 · A11y pass** (focus order, aria-labels on icon buttons, contrast on badges). — accept: axe clean on custom pages.
- **P11-4 · Test suite consolidation** (jest configured ✅; integration via @medusajs/test-utils for: gating, transitions, e-mail idempotency, backfill, summary). — accept: CI green.

### Phase 12 — production reconciliation & go-live
- **P12-1 · Staging full smoke** (§25 checklist scripted where possible).
- **P12-2 · Prod: backfill run, historic payment_problem reconcile, layout default apply, locale set, digest enabled.** — accept: §25 all ✓ on prod.
- **P12-3 · Runbooks** (orphan packet, failed e-mail, stuck payment) in `docs/runbooks.md`.

## 25. Acceptance criteria

1. Normal paid order processed start-to-ship entirely in Denní práce (2 clicks), native page optional. ☐
2. „Odesláno" (stage, native status, customer e-mail) impossible without a successful native shipment — including in record-only carrier mode, where it requires the explicit „Zásilku jsem předala dopravci" confirmation (A1; UI and direct API). ☐
3. No order ships while money is outstanding — proven **numerically** (A2): captured−refunded ≥ payable ± ε, pending_difference ≤ ε, no active order edit, no open collection; MTO additionally outstanding = 0 (workflow + middleware tests incl. edited-after-capture case). ☐
4. Every queue/workspace card shows exactly one primary action. ☐
5. Every failure (ship, e-mail, carrier, payment) is visible on Přehled/bell and recoverable by a labeled retry. ☐
6. Every customer e-mail is traceable per order (widget) with idempotent resend. ☐
7. Double-clicks/re-delivered events never duplicate: shipment, e-mail, payment link, stage (tests). ☐
8. No technical IDs on custom pages; §17 banlist grep clean. ☐
9. Czech terminology consistent (locale set + custom strings per this doc). ☐
10. Settings native and untouched (diff proof). ☐
11. All §18 validations enforced server-side (UI-bypass tests). ☐
12. Typecheck + both builds green every phase; Railway smoke per phase log. ☐
13. Jobs idempotent across restarts (dedupe keys asserted). ☐
14. Historic orders reconciled; queues match native truth on prod sample of 20 orders. ☐

## 26. Summary

**1. Final structure:** §2.2 — Přehled · Denní práce(5) · Objednávky+Koncepty · Zakázková výroba(2) · Sklad(+2) · Produkty(+3 custom children) · Recenze · Sezónní výběry · Propagace · Zákazníci · Nastavení; hidden: Ceníky, native Kolekce/Kategorie, Sanity, Segment.

**2. Five highest-value improvements:** (1) wiring the 12 dormant lifecycle e-mails to native events; (2) working merchant awareness (feed bell + urgent e-mails + daily digest); (3) ship-gating (payment/MTO/pickup) enforced server-side; (4) Packeta correctness (COD/weight/value/tracking) + ČP unblock; (5) Přehled dashboard with the „Na řadě" list.

**3. Five largest current risks:** (1) Packeta provider sends COD for every order — live money-collection bug until Packeta options are actually removed (D8/P4-5 sequencing matters: options off before any new order can pick them); (2) ČP/Balíkovna has no working provider — one-click ship fails for those options until P4-1's fallback lands; (3) balance-request event has no subscriber — customers never get the payment link e-mail; (4) no payment-expiry reconciliation — orders can stall silently; (5) queues unpaginated + legacy orders absent until backfill.

**4. Essential custom modules (all thin):** merchant-order (stage overlay) ✅, made-to-order ✅, merchant-catalog (presentation+seasonal) ✅, bundled-product ✅, product-review ✅, restock ✅, comgate provider ✅, **new: merchant-settings accessor (A3 — allowlisted keys; `store.metadata` preferred, table only on concrete blocker)** — everything else is subscribers/jobs/pages over native.

**5. Native features replacing custom logic:** Czech locale (replaces any relabeling code); draft-order plugin; notification module as e-mail/feed audit+dedupe (replaces any custom e-mail log); Layout Configuration (replaces nav hacks); order list/detail workflows for all money/status reads ✅; Order Edit for price changes ✅; payment collections/sessions for links ✅; native fulfilment chain for shipping ✅; native inventory/reservations; native price lists under seasonal selections; native promotions/campaigns pages.

**6. Recommended order:** P0 verify → P1 foundations/nav → P2 notifications+dashboard → P3 queue hardening → P4 carriers → P5 e-mails → P6 MTO → P7 sklad+bundles → P8 produkty → P9 recenze+sezóny → P10 zákazníci → P11 QA → P12 go-live. (Dependency-driven: P2 infra unlocks P3–P6 notifications; P4 before P5's shipment e-mail carries real tracking.)

**7. Business decisions — RESOLVED 2026-08-04 (these supersede any conflicting statement elsewhere in this document):**

- **D1 (was Q1) — No COD, prepaid only.** The shop takes online payment (ComGate) exclusively. Ship gate everywhere = payment captured (MTO: outstanding = 0). All COD conditionality is removed from the spec; any carrier `cod` field is always 0.
- **D2 (was Q2) — Carrier labels arrive by e-mail; default parcel weight 2,5 kg** (merchant-settings `default_parcel_weight_kg`, per-product weight wins when filled). Applies to the Balíkovna integration (D8).
- **D3 (was Q3) — Deposit refund is decided per case.** Cancel dialog for a paid-deposit zakázka asks: „Vrátit zálohu {X} Kč?" → Ano runs the native ComGate refund; Ne forfeits (logged in internal note). No automatic refunds.
- **D4 (was Q4) — The balance flow is fully manual; automation is notification-only.** Confirmed sequence: deposit paid at order time → when production is done, **she clicks** „Požádat o doplatek" (that click sends the payment-link e-mail) → when the customer pays, **she receives an e-mail** „Doplatek přijat" (OWNER e-mail, not just bell) → **she ships manually**. There is **no automatic reminder** — the „Připomenout" button and the overdue badge (+7 d) are the only nudges. Nothing in the system ships, requests money, or reminds on its own.
- **D5 (was Q5) — All reviews moderated manually.** No auto-publish at any rating.
- **D6 (was Q6) — Unpaid orders are never auto-cancelled.** Badge + notification only; cancelling is always her explicit action.
- **D7 (was Q7) — Two notification recipients, split by audience:**
  - `DEV_NOTIFICATION_EMAIL` (Matěj): technical failures — carrier/API errors, e-mail delivery failures, core/system errors.
  - `OWNER_NOTIFICATION_EMAIL` (klientka): business events — new paid order (per-event e-mail, same as today's expectation), balance received, payment problems on orders, stock digest items, reviews.
  - **Daily summary (07:05) goes to BOTH** and its content is deliberately lean: **denní tržby (zaplacené objednávky, Kč)** + **počet nedokončených objednávek (koncepty + opuštěné košíky)** + link to Přehled. Explicitly *not* a full order-count report. Env values will be filled in by Matěj at deployment (Phase 0 creates the vars, empty = notification skipped with a logged warning, never a crash).
**Amendments A1–A3 (2026-08-04, post-review by Matěj — supersede conflicting text; woven into §5.4, P3-4, P4-1, P1-1, §18, §25):**

- **A1 — Two-phase dispatch when no carrier-side record exists.** The record-only fallback (and any fulfilment without a shipment) creates the native fulfilment only — it must **not** create a native shipment, must not send the shipment e-mail, must not move `MerchantOrderState` to `shipped`. The order stays in **K odeslání** showing the blocking state **„Čeká na ruční podání zásilky."**; the merchant explicitly confirms **„Zásilku jsem předala dopravci"**, and only that confirmation runs `createOrderShipmentWorkflow` + customer e-mail + stage transition. Full spec: §5.4. API mode (real Balíkovna packet + tracking) remains single-click — a carrier-side record exists at creation.
- **A2 — The shipping payment invariant is numerical, not status-based.** `payment_status = captured` is display-only. The authoritative ship gate for ordinary orders: **(a)** captured − refunded ≥ effective payable total within currency tolerance (`getEpsilonFromDecimalPrecision`), **(b)** `order.summary.pending_difference ≤ ε`, **(c)** no active order change (`order.order_change`), **(d)** no open payment collection still awaiting money. MTO orders additionally keep `outstanding = 0`. Rationale: an order edit after capture (the MTO confirm-spec flow does exactly this) leaves a stale-true `captured`.
- **A3 — Settings storage is allowlisted and storage-agnostic.** Before building the KV table, evaluate storing under `store.metadata.merchant_settings` via native `updateStoresWorkflow` (native `@medusajs/settings` is layout/view-config only — verified, not a generic store). Either way, all access goes through one typed accessor (`src/lib/merchant-settings.ts`) with a **closed key allowlist**: `low_stock_default_threshold`, `default_parcel_weight_kg`, `review_request_days`, `production_started_email_enabled`, `daily_digest_enabled`, `onboarding_dismissals` (shop-global by accepted simplification). Adding a key = editing the zod schema in that one file. **Prohibited:** workflow truth, per-order/per-entity state, caches, anything the commerce modules own. If `store.metadata` suffices, the plan's only migration disappears.

- **D8 (was Q8) — Packeta is being retired; Balíkovna B2B is the carrier integration to build.** Matěj removes Packeta shipping options in the admin himself. The plan must: (a) build a `balikovnaFulfillment` provider (AbstractFulfillmentProviderService) calling the Balíkovna/ČP B2B API for packet + label + tracking, fully env-driven (`BALIKOVNA_API_*` — values supplied later), with a **graceful record-only fallback while credentials are absent** so one-click shipping never blocks on missing config; (b) keep the physical process unchanged — she still hands parcels over herself; (c) treat the Packeta provider as legacy: Phase 0 counts unshipped Packeta-method orders; if zero, the provider is left dormant and its planned fixes are dropped; if any exist, they are shipped manually via the native page before options removal. Storefront dependency flagged: checkout needs a Balíkovna pickup-point picker to replace the Packeta widget (outside admin scope, blocking for B2B pickup delivery).

---

**References:** Medusa 2.18 docs (Admin Widgets, UI Routes, Layout Configurations, workflows reference — URLs in [docs/denni-prace-audit.md](docs/denni-prace-audit.md) §7) · installed source paths cited inline throughout · ComGate API (apidoc.comgate.cz — provider verified: verified-callback + `retrieveDetails` + `refundPayment` in [service.ts](backend/src/modules/comgate/service.ts)) · Packeta REST API (docs.packetery.com — **verify `value`/COD units in P4-2 against current docs, do not trust the in-code comment**) · Resend (resend.com/docs — provider working) · Balíkovna/ČP B2B (requires credentials — Q8) · Railway (existing deployment; per-phase smoke in §24).

*End of WorkflowPlan. Implementation may begin at Phase 0 upon approval; Phases must not be reordered without updating §24 dependencies.*

---

## §0-notes — P0-1 runtime findings (appended 2026-08-04)

Gathered read-only against the production database via Railway's TCP proxy with
`default_transaction_read_only=on` (method in `docs/p0-1-runtime-findings.md`).
Partial: four facts verified, four still pending a human-run query batch.

**1. Stock locations — TWO, not one. §10's assumption fails.**

| id | name |
| --- | --- |
| `sloc_01K2JKVD3PGPRMHY7SHBT55W65` | European Warehouse |
| `sloc_01K2YB46G59T1BRH6EYKQ6K30D` | Keramická Zahrada |

„European Warehouse" looks like boilerplate seed data, but which location
actually holds inventory and fulfilment sets is not yet verified. Consequence:
§10's „one stock location assumed" no longer holds, so every stock query must
aggregate `available` **across** locations rather than read one. Deactivating
the dormant location is a production action for Matěj.

**2. Shipping options — two, both flat price, no COD (D1 holds).**

| id | name | provider_id |
| --- | --- | --- |
| `so_01K2JNAER4GEGP0R011HC37PWS` | Česká pošta | `ceska-posta-fulfillment_ceska-posta-fulfillment` |
| `so_01K2JN98M2ACBVFCZREZTD2HTF` | Zásilkovna | `packeta_packeta` |

**3. Fulfilment providers:** `packeta_packeta` (enabled),
`ceska-posta-fulfillment_ceska-posta-fulfillment` (enabled), `manual_manual`
(disabled).

→ **P4-1 constraint:** the Balíkovna provider must register under the composite
id `ceska-posta-fulfillment_ceska-posta-fulfillment` — module key *and* static
`identifier` both `ceska-posta-fulfillment` — to reuse the existing „Česká
pošta" shipping option. Any other id means migrating that option's
`provider_id` in production.

**4. Payment providers:** `pp_comgate_comgate` (enabled) and
`pp_system_default` (**enabled**). D1 says prepaid only; an enabled
manual-payment provider is a COD-shaped hole if checkout ever offers it.
Flagged for Matěj — provider enablement is production state, not an agent's
call.

**Still pending** (read-only query batch in `docs/p0-1-runtime-findings.md`):
which location is actually wired · MTO `enabled × manage_inventory` counts
(P6-6) · unshipped Zásilkovna orders by status (P0-4 → P4-5) · backfill scale
(P3-3).
