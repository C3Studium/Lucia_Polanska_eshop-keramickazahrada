# Admin deepening — two-speed workflow

Written 2026-08-06, before implementation, as the record of what exists, the
rules Matěj set, and what gets built. The implementation log continues in
`implementation-log.md`.

## The vision, in one paragraph

The admin has two speeds. **Přehled** is the standard workflow: everything the
owner needs on a normal day, in simple Czech, one sidebar item — she can run
the whole shop without leaving it. The **dedicated pages** (Objednávky,
Produkty, Sklad, Zákazníci, plus Slevy's deep views) are the advanced
workflow: the same domains, several levels deeper — more data, more
functions, batch work, history, editing of things Přehled only displays. She
escalates to them when a day is not normal; she is never forced into them.
The current custom modules are the template to deepen, not the ceiling.

## Rules in force (set by Matěj)

1. **Never „pay later".** Customers always pay something at checkout.
2. **Made-to-order: the customer chooses how much** — a slider in cart or
   checkout, bounded by the **owner's per-product minimum** below and the full
   price above. The floor already exists in the backend
   (`default_deposit_percentage` per product, `deposit_percentage_override`
   per variant) and is what the owner edits; the server clamps, the slider is
   only a courtesy.
3. **Automations: propose, do not implement.** §Automation ideas below.
4. Standing rules stay: Czech UI / English code, §17 terminology banlist,
   A1 dispatch invariant, A2 numeric ship gate, A3 settings allowlist,
   5-item sidebar, no dobírka framing anywhere.

## Current state (verified in context, not re-audited)

- **Přehled** — 11 tabs in 4 groups: Přehled · Denní práce · Zakázky · Platby
  · Produkty · Zásoby · Slevy a akce · Recenze · Vrácení · Odeslané e-maily ·
  Statistiky. Backed by `/admin/operations/*`, `/admin/inventory-alerts`,
  `/admin/merchant-orders`, `/admin/made-to-order/*`, `/admin/reviews`,
  `/admin/return-requests`, `/admin/merchant-catalog/*`.
- **Sidebar** — Přehled, Objednávky, Sklad, Produkty, Zákazníci (native
  Medusa pages for the last four); promotions and price lists hidden.
- **Tests** — 258 unit, 50 integration (real app + real DB, one boot).
- **Storefront** — §4 of the brief built (made-to-order purchase path);
  §5–§8 in progress by the storefront model.

## What "four levels deeper" means per area

Each dedicated page keeps Přehled's vocabulary and adds, in order of depth:
**(1) all the data** where Přehled shows a summary, **(2) editing** where
Přehled shows a value, **(3) batch operations** where Přehled acts on one
thing, **(4) history/explanation** where Přehled shows the present.

### Objednávky → `/objednavky` (custom, replaces native in sidebar)

- Worklist across *all* orders (native list shows Medusa statuses only):
  merchant stage, payment vs. total (A2 numbers), fulfilment, MTO flag,
  balance outstanding, channel, age. Filter chips per stage/problem.
- Row expansion: items, payments ledger, production state, e-mail history for
  that order (from notifications), shipping label action, „Kontaktovat
  zákazníka".
- Batch: move stage (respecting the transition table), print labels,
  request balances for all orders owing money.
- History: stage timeline (`stage_changed_at/by` already recorded).

### Produkty → `/produkty` (custom, replaces native in sidebar)

- Catalog workbench: every product with price, stock across variants,
  category/collection, publish state, type (běžné/zakázka/výprodej/balíček),
  30-day sales, wishlist count, review average.
- **Production profile editor** — the owner's minimum (slider floor), lead
  time, specification prompt, allow-full toggle. This is where rule 2's floor
  is set; it closes the long-missed P8-3.
- Inline edits: price (region-aware), publish/unpublish, clearance flag.
- Batch: assign category/collection, publish, add to seasonal sale.

### Sklad → `/sklad` (custom, replaces native in sidebar)

- Inventory workbench: every variant with level, threshold, incoming,
  location; low/out/ok filters reusing `inventory-alerts` buckets exactly.
- **Demand signal**: restock-subscription count per variant — how many
  customers are waiting — and wishlist count, so restocking is ordered by
  demand, not alphabet.
- Threshold editing (per variant), quick add-stock (exists in Přehled → keep),
  batch add for a delivery day.
- History: stock movements where the module records them.

### Zákazníci → `/zakaznici` (custom, replaces native in sidebar)

- Customer workbench: orders count, lifetime value, outstanding balances,
  last order, newsletter status, wishlist size, reviews written, restock
  subscriptions.
- Detail: full order list with stages, balance links, e-mail history,
  „Napsat zákazníkovi" (mailto), notes (Medusa metadata).
- Filters: owes money · has wishlist · newsletter subscriber · repeat buyer.

### Slevy — deep views stay under Přehled (sidebar stays at five)

- Promotion editor deepened: codes with usage counts, per-rule targeting,
  scheduling; price-list editor: bulk price rows, import-free quick edit.
- Seasonal sale: product membership editing in place (chips), end-behaviour
  visible (`on_end`).

## Storefront consequences (separate brief)

`docs/storefront-advanced-prompt.md` — written after the backend lands, so it
quotes real payloads. Headline: the deposit **slider** replaces the two-radio
choice (§4.3 of the old brief); floor from the API, never client-computed;
plus surfacing of restock demand („X lidí čeká") only if Matěj approves
showing counts publicly.

## Automation ideas — proposed, deliberately NOT implemented

1. **Balance reminder escalation** — unpaid balance N days after
   „hotovo": one reminder, then a merchant task instead of more e-mails.
2. **Auto-label on stage change** — moving to „K odeslání" pre-creates the
   Balíkovna shipment when the ČP account exists.
3. **Restock-demand digest** — weekly: out-of-stock variants ordered by
   waiting subscribers + wishlists, as a buying list.
4. **Review nudge window** — request-reviews already exists; add a second
   nudge only if the first was opened but not acted on (needs Resend webhook
   events — infrastructure first).
5. **Seasonal sale auto-publish/retire** — scheduled start/end already
   half-exists (`on_end`); add scheduled *start*.
6. **Stale-cart follow-up #2** — one more nudge 7 days after the abandoned
   e-mail, only for carts above a value threshold.

Each is a switch in Nastavení when built — none ships now.

## Implementation order (this session)

1. Slider backend: `production-payment-mode` gains `mode:"custom"` +
   validated amount; `prepare-made-to-order-payment` honours it; tests.
2. Admin API: workbench endpoints (`/admin/workbench/orders`, `/products`,
   `/inventory`, `/customers`) — thin aggregations over existing modules,
   projections tested by integration suite.
3. The four pages + sidebar registration (payload change documented for
   Matěj in TODO-launch.md).
4. Slevy deep views.
5. Storefront advanced brief.
6. Gate + log + this file's checkboxes updated.
