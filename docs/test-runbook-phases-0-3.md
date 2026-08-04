# Test runbook — Phases 0–3

Everything on `feat/admin-operating-plan` in one checklist. Work top to bottom;
each section says what to do, what should happen, and what it would mean if it
does not.

**Before you start**

- **No migrations.** Nothing in Phases 0–3 adds a table, a column or an index,
  so `pnpm db:migrate` is not required for any of this. If the deploy asks for
  one, something is wrong — stop and say so.
- No new **required** environment variables. The six added ones are all optional
  and everything degrades to a logged warning when they are unset.
- Expected local state: `pnpm typecheck`, `pnpm build` and `pnpm test:unit`
  (78 tests, 8 suites) all green.

---

## 0. Deploy sanity

| Step | Expected |
| --- | --- |
| Deploy the branch | Build succeeds; server starts |
| `GET /health` | `200` |
| Boot log | No notification-provider errors. The notification module is now registered unconditionally, so it initialises even without e-mail env. |

If the boot fails on the notification module, that is the one genuinely new
registration — tell me the log line.

---

## 1. Navigation (Phase 1)

1. Sidebar shows **Zakázková výroba** as its own section with two children,
   **Zakázky** and **Produkty na zakázku**.
2. „Výroba na zakázku" is **gone** from under Produkty.
3. **Sklad** now has **Nízký stav** and **Vyprodáno** under it.
4. **Přehled** and **Sezónní výběry** exist as top-level items.
5. Open `/app/made-to-order` directly → redirects to
   `/app/zakazkova-vyroba/produkty`, and the profile manager still works (open a
   product, change the deposit %, save).
6. Old `/app/merchant-orders` still redirects to `/app/denni-prace`.

**Empty-state pages** (they have no data source until Phase 6/7 — this is
expected, not a bug): Zakázky, Nízký stav, Vyprodáno each show a Czech
empty state. Nízký stav should name the real threshold („3 kusy"), which proves
`GET /admin/merchant-settings` and the settings accessor work end to end.

---

## 2. Recenze (Phase 1)

1. Three tabs, **Čekají na schválení** selected by default.
2. Switching tabs changes the list and resets to page 1.
3. **No ID column** anywhere, and no „Status" column (the tab says it).
4. Approve a pending review → it moves to **Schválené**.
5. With no pending reviews, the empty state reads „Žádné recenze nečekají".

---

## 3. Sezónní výběry (Phase 1)

1. Page loads; three tabs (Naplánované / Aktivní / Archivované).
2. If a selection exists whose `ends_at` has already passed, it must appear
   under **Archivované** even if its status still says published — the grouping
   uses status *and* dates deliberately.
3. No „+ Nový výběr" button yet; the wizard is P9-3.

---

## 4. Sidebar order (Phase 1 — your action)

Apply the payload in [backend/scripts/set-sidebar-order.md](../backend/scripts/set-sidebar-order.md)
**on staging first**.

1. Log in as a **second** admin user and confirm the §2.2 order.
2. Ceníky, Sanity CMS, Segment Analytics and the native Kolekce/Kategorie
   children are hidden.
3. Nastavení is untouched (it is rendered outside the composer zone and cannot
   be reordered by this payload — that is by design).
4. Rollback if needed: `DELETE` on the same endpoint.

Open decision, no rush: the draft-order plugin's sidebar label is hardcoded
English („Drafts"). Options and a recommendation are at the bottom of that file.

---

## 5. The bell and merchant notifications (Phase 2)

1. Open the bell in the top bar — it renders without error, even when empty.
   (Before this branch there was no `feed` provider at all, so it was dead.)
2. Place a **test order** end to end.
   - Bell shows „Nová zaplacená objednávka #…".
   - The order appears in **Denní práce → Nové**.
3. **Idempotency:** the same order must never produce two bell entries. If you
   can replay the `order.placed` event, do; otherwise trust the unit tests and
   watch for duplicates during normal use.
4. Move an order to **K odeslání** → bell shows „…je připravená k odeslání".

**E-mail copies (D7).** With `OWNER_NOTIFICATION_EMAIL` unset — the current
state — the bell works and every merchant e-mail is *skipped with a logged
warning*. That is the specified behaviour, not a failure. Set the variable to
turn on the inbox copies for „Nová zaplacená objednávka" and „Doplatek přijat".

---

## 6. Přehled (Phase 2)

1. Tiles match reality. Cross-check at least two:
   - „Nové objednávky" vs the count on Denní práce → Nové.
   - „Recenze ke schválení" vs the Recenze pending tab.
2. **Vyžaduje pozornost** is absent entirely when nothing is wrong (it is not
   supposed to show a row of zeroes).
3. „Na řadě" lists up to five oldest actionable orders using the *same card* as
   the queues, with the same single action.
4. „Obnovit" works; the page also refetches every 30 s and on window focus.

---

## 7. Failed e-mails — the loop you asked for (Phase 2)

This is the one worth testing deliberately, on **staging**:

1. Temporarily set an invalid `RESEND_API_KEY`.
2. Place an order (or trigger any customer e-mail).
3. **Přehled → Nezdařené e-maily** (`/app/prehled/emaily`, reached from the
   tile — it is deliberately not in the sidebar):
   - the row is there, marked **Nepodařilo se**;
   - the Přehled tile „Nezdařené e-maily" counts it.
4. Click **Poslat znovu** → it should fail again and show **Resend's actual
   message** (e.g. `validation_error: …`), not a generic „nepodařilo se".
5. Restore the real key, click **Poslat znovu** again → succeeds, and the row
   for the retry appears marked „Opakované odeslání".
6. Wait for a quarter-hour boundary → the `watch-failed-emails` job logs, and a
   bell entry „E-mail se nepodařilo odeslat" appears **once** per failed
   notification.

Before this branch, step 3 would have shown nothing at all: the provider
returned success on failure, so an e-mail nobody received was recorded as
delivered.

---

## 8. Daily summary (Phase 2)

Sends at **07:05** to both notification addresses, and only if at least one is
set. To check without waiting a day, confirm the job is registered in the boot
log (`send-daily-summary`). Content is deliberately three numbers and a link:
yesterday's takings, unfinished purchases, Přehled.

---

## 9. Denní práce (Phase 3)

1. **Cancellation:** cancel an order on the native page. Within 30 s (or on
   window focus) it must leave its queue. Before this branch it stayed in Nové
   asking to be packed.
2. **Pagination:** with more than 50 orders in one stage, the queue pages at 50
   and the header shows the total. Paging must not flash skeletons.
3. **Backfill:** open Denní práce. If orders predate the queue module a banner
   appears with a count.
   - Click **Načíst** → toast with the number created; banner disappears.
   - Click again (reload first) → reports **0 created**. It is idempotent by
     design; if it creates rows twice, stop and tell me.
   - Cancelled historic orders must land in `cancelled`, not in Nové.

---

## 10. The ship gate — the most important test (Phase 3, AC-3)

**10a. Normal path.** A fully paid order in **K odeslání** shows „Vytvořit
zásilku a odeslat". Click it. On the native order page confirm that a
**fulfilment and a shipment** both exist and `fulfillment_status` is `shipped`.

**10b. Edited after capture — the case the gate exists for.** Take a paid order
in K odeslání, then on the native page **edit it to increase the total**. Return
to the queue:

- the button must be **gone**;
- the card must say what is missing, in Czech, with the amount.

This is the hole a status check cannot see: `payment_status` still says
`captured` while the customer now owes more. It is exactly what the
made-to-order confirm-price flow does.

**10c. UI bypass.** With that same order, call the API directly:

```bash
curl -X POST "$BACKEND_URL/admin/merchant-orders/<order_id>" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"stage":"shipped"}'
```

Must be **rejected** with the same Czech reason. The order must remain in
K odeslání with no fulfilment created.

> **Known gap:** `POST /admin/orders/:id/fulfillments` — the *native* fulfilment
> route — is **not yet guarded**. That is P4-4's middleware, which sits in the
> blocked Phase 4. Until then the native order page can still fulfil an unpaid
> order. The queue cannot.

**10d. Double click.** Click the ship button twice quickly → exactly one
shipment, no error. The workflow holds a lock for its whole run.

**10e. Failure.** Force a dispatch failure (easiest: an order whose shipping
method has no stock location — note there are **two** locations in production,
see below). Expected: the order **stays** in K odeslání, the toast carries the
real reason, and a bell entry „Zásilku se nepodařilo vytvořit" appears.

---

## 11. Things for you to decide or check (not code)

1. **Two stock locations exist in production** — „European Warehouse" and
   „Keramická Zahrada" (P0-1). The plan assumed one. Stock queries here already
   aggregate across locations, so nothing is wrong, but if „European Warehouse"
   is dead seed data it should be deactivated, and it may explain any
   fulfilment that cannot resolve a location.
2. **`pp_system_default` (manual payment) is enabled** in production. D1 says
   prepaid only. Worth confirming checkout never offers it — if it does, that is
   a COD-shaped hole in the „never ship before capture" story.
3. **Notification addresses.** Set `OWNER_NOTIFICATION_EMAIL` and
   `DEV_NOTIFICATION_EMAIL` in Railway when you want the inbox copies.
4. **The remaining P0-1 queries** — the read-only batch at the bottom of
   `docs/p0-1-runtime-findings.md`. It answers which location is wired, the MTO
   `manage_inventory` counts (P6-6) and the unshipped Zásilkovna order count
   (P4-5). **Phase 4 needs that last one.**
