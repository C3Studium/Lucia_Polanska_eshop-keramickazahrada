# Storefront brief — finish what the backend already exposes

Read this whole brief before touching anything. Then start at §8.

## 1. Mission

You are the implementing engineer for the **storefront** of *Keramická zahrada*
— a handmade-ceramics e-shop. Next.js in `storefront/`, Medusa 2.18 backend in
`backend/`, both on Railway.

The backend admin has been rebuilt over the last two days. Several features are
**complete and live on the server but have no storefront counterpart**, so the
customer never sees them — and in one case a customer cannot complete a purchase
at all. Your job is to close that gap. You are not designing new backend
behaviour; every endpoint you need already exists and is listed below with its
exact shape.

The shop's owner is a ~50-year-old Czech-speaking ceramicist. **All
customer-facing copy is Czech.** Code and comments in English.

Your human counterpart is **Matěj** (developer, repo owner). He holds every
credential and all deploy rights.

## 2. The one thing that is actually broken

**Made-to-order products cannot currently be bought.**

The backend requires a specification (the customer's description of what they
want) on any made-to-order line item, at
`cart.items[].metadata.made_to_order.specification`. The storefront never sets
it — there are zero references to `made_to_order` anywhere in `storefront/src`.

So `prepare-made-to-order-payment` throws:

> „Doplňte prosím krátký popis požadovaného provedení."

Everything in §4 below is the fix. **Do this first.** The rest of the list is
value; this is a broken checkout.

## 3. Ground rules

1. **Never invent an endpoint.** Every route you need is in §4–§7 with its
   method, path and payload. If something seems missing, it is either
   deliberately out of scope or a genuine backend gap — say so, do not build a
   workaround that writes state the backend does not know about.
2. **Czech, and specific.** „Záloha 25 %" not „Deposit". Use the strings quoted
   here — they match what the admin and the e-mails already say, and a customer
   who reads three different words for one thing assumes three things.
3. **Never show a price you did not get from the server.** Deposit and total are
   returned by the API precisely so the checkout does not do its own arithmetic.
   Two implementations drift, and the number the customer reads must be the
   number they are charged.
4. **No dobírka.** Cash on delivery does not exist in this shop and must never
   appear as an option for a *carrier* shipment. The single exception is
   personal collection — see §5.
5. **Do not touch `backend/`.** If you believe a backend change is required,
   stop and write it down for Matěj.
6. Match the existing storefront's conventions — its data-fetching layer lives
   in `src/lib/data/`, and its components in `src/modules/`. Follow what is
   there rather than introducing a new pattern.

## 4. TODO — made-to-order (highest priority)

### 4.1 Product page: show that it is made to order

`GET /store/products/:id/production-profile`

```jsonc
{ "production_profile": null }        // ordinary product — render nothing
{ "production_profile": {
    "enabled": true,
    "specification_required": true,
    "specification_prompt": "Co má zákazník napsat?",
    "production_time_min_days": 14,
    "production_time_max_days": 42,
    "default_deposit_percentage": 25,
    "allow_full_prepayment": true,
    "variants": [ { "variant_id": "…", "deposit_percentage_override": 30 } ]
} }
```

Render, above the add-to-cart button:

- **„Vyrábí se na zakázku"** with the lead time: „Hotové za 14–42 dní".
- The deposit: „Nyní zaplatíte zálohu 25 % — {částka} Kč. Zbytek doplatíte, až
  bude hotovo."
- The variant override wins over the product default when a variant is selected.

### 4.2 Product page: collect the specification

When `specification_required` is true, show a required textarea labelled with
`specification_prompt`, and **block add-to-cart until it has content**. The
backend rejects an empty one, so a client-side check only saves the customer a
round trip — it is not the guard.

Send it as line-item metadata:

```ts
metadata: { made_to_order: { specification: "…" } }
```

### 4.3 Checkout: deposit or pay in full

`GET /store/carts/:id/production-payment-mode`

```jsonc
{
  "has_made_to_order": true,   // false → render nothing, this is an ordinary cart
  "can_pay_full": true,        // false → offer deposit only
  "mode": "deposit",           // current choice
  "deposit_amount": 1500,      // charged now if she picks deposit
  "full_amount": 6000,         // charged now if she picks full
  "balance_later": 4500        // owed later under the deposit option
}
```

`POST` the same path with `{ "mode": "deposit" | "full" }`.

Render two radio options, **deposit selected by default**:

- „Zaplatit zálohu {deposit_amount} — zbytek {balance_later} doplatíte, až bude
  hotovo."
- „Zaplatit rovnou celou částku {full_amount} — pak už nic neřešíte."

Only when `has_made_to_order` is true. Only offer the second when
`can_pay_full` is true. **Use the amounts as returned.**

### 4.4 Express checkout: the same choice

`src/app/[countryCode]/(express-checkout)/express-checkout/[handle]/page.tsx`
buys a single product directly. If that product is made to order it needs the
specification field (§4.2) **and** the payment choice (§4.3), or express
checkout becomes a second way to hit the same broken path.

### 4.5 Account: pay an outstanding balance

An order with an unpaid balance shows a **„Doplatit {částka}"** button linking
to the signed URL the customer was e-mailed. The e-mail already carries it; the
account page should not be a worse place to find it.

If you need to generate it storefront-side rather than reading it from the
order, that is a **backend gap** — write it down, do not guess the signature.

## 5. TODO — personal collection and paying on arrival

The backend now has an **„Osobní odběr"** fulfilment provider and a **`pickup`
payment provider**.

### 5.1 Shipping step

„Osobní odběr" appears as a normal shipping option. Show the workshop address
and that there is nothing to pay for delivery.

### 5.2 Payment step — the rule that matters

**„Zaplatím při vyzvednutí" is offered only when the chosen shipping option is
Osobní odběr.** For every other shipping option it must not be selectable, and
switching away from personal collection must clear it.

This is not dobírka. No carrier is ever involved, no money is collected by
anyone but the owner, in her workshop. Copy should say so: „Zaplatíte na místě
při vyzvednutí." Never „na dobírku".

The provider authorizes and never captures, so the order is placed and the
money is recorded when she hands the piece over. **Do not present it as paid.**

## 6. TODO — notifications customers can ask for

### 6.1 Restock — partially done, verify

`POST /store/restock-subscriptions` exists and the storefront references restock
in `src/lib/data/products.ts` and the product details component. **Verify it
works end to end** on a sold-out variant, and that the customer gets confirmation
that they will be told. If it is half-wired, finish it.

### 6.2 Sold-out state

A variant with no availability must say **„Vyprodáno"** and offer the restock
sign-up instead of add-to-cart. Availability logic already exists in
`src/lib/util/availability.ts` — use it rather than writing a second rule.

### 6.3 Price drop — **backend gap, do not build**

`price-drop.tsx` exists as an e-mail template with **nothing that sends it**:
there is no subscription table, no job, no trigger. A storefront sign-up button
would write to nothing.

Write it down for Matěj as a backend feature. Do not build a UI for it.

## 7. TODO — order status in the account

Native store orders expose `fulfillment_status` and `payment_status`. Map them
to plain Czech on the account order page and in the order list:

| Backend state | Customer sees |
| --- | --- |
| not fulfilled, paid | „Přijato — chystáme" |
| fulfilled, not shipped | „Zabaleno" |
| shipped | „Odesláno" |
| delivered | „Doručeno" |
| canceled | „Zrušeno" |

**Backend gap worth naming:** the admin's own stage (`Nové · Připravujeme ·
K odeslání · Odesláno`) is richer than what the store API exposes, and there is
no store route for it. „Připravujeme" is therefore not available to the
customer. If Matěj wants that precision, it needs a small backend route — write
it down rather than approximating with fulfillment status.

Refresh on focus rather than polling on a timer. These states change a few times
over days, and a request every few seconds for that is waste.

## 8. Start here

1. Read this brief, then look at how `src/lib/data/` and `src/modules/` are
   organised — match them.
2. Confirm the storefront builds clean before you change anything, so later
   breakage is attributable.
3. Work **§4 first, in order**. It is a broken purchase path; everything else is
   an improvement.
4. Then §5, §6, §7.
5. Keep a short log of what you did and anything you found that contradicts this
   brief. Two things in here are marked as backend gaps (§6.3, §7) — if you find
   a third, add it rather than working around it.

## 9. What is already done — do not rebuild

- **Wishlist** — integrated across ~20 files.
- **Reviews** — integrated across ~15 files, including submission. The backend
  now rejects a second review of the same product by the same customer, and more
  than three a day from one name; both return Czech messages meant to be shown
  verbatim.
- **ComGate payment** — working. Note it is in **test mode**
  (`COMGATE_TEST`), so payments are not real yet.
- **Abandoned cart e-mails** — a backend job, no storefront work needed.

## 10. Reporting

When you finish, state: what you completed, what you could not and why, any
backend gap you found, and anything in this brief that turned out to be wrong
about the current storefront. Do not report something as working that you have
not run.
