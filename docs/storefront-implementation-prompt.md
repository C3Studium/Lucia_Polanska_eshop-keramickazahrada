# Storefront brief — connect the storefront to the backend's new features

Read this whole brief before touching anything. Then start at §11.

## 1. Mission

You are the implementing engineer for the **storefront** of *Keramická zahrada*
— a handmade-ceramics e-shop. Next.js in `storefront/`, Medusa 2.18 backend in
`backend/`, both on Railway.

The backend has been rebuilt over the last week. A set of features is **finished
and live on the server with no storefront counterpart**, so the customer never
sees them — and in one case a customer cannot complete a purchase at all. Your
job is to close exactly that gap: the storefront side of backend features that
already exist.

You are not designing backend behaviour. Every endpoint, provider id and payload
below was read out of the running backend and is quoted exactly.

The shop's owner is a ~50-year-old Czech-speaking ceramicist. **All
customer-facing copy is Czech.** Code and comments in English.

Your human counterpart is **Matěj** (developer, repo owner). He holds every
credential and all deploy rights.

## 2. The one thing that is actually broken

**Made-to-order products cannot currently be bought.**

The backend requires a specification — the customer's description of what they
want — on every made-to-order line item, at
`cart.items[].metadata.made_to_order.specification`. The storefront never sets
it: there are **zero** references to `made_to_order` anywhere in
`storefront/src`.

So `prepare-made-to-order-payment` throws:

> „Doplňte prosím krátký popis požadovaného provedení."

§4 is the fix. **Do it first.** Everything after it is value; this is a broken
checkout.

## 3. Ground rules

1. **Never invent an endpoint.** Every route you need is below with its method,
   path and payload. If something seems missing it is either out of scope or a
   real backend gap (§10) — say so; do not write state the backend cannot read.
2. **Czech, and specific.** „Záloha 25 %" not „Deposit". Use the strings quoted
   here — they match the admin and the e-mails, and a customer who meets three
   words for one thing assumes three things.
3. **Never show a price you calculated.** Deposit, total and balance are
   returned by the API precisely so the checkout does no arithmetic. Two
   implementations drift, and the number the customer reads must be the number
   they are charged.
4. **No dobírka.** Cash on delivery does not exist in this shop and must never
   appear for a *carrier* shipment. Personal collection (§5) is a different
   thing and must never be labelled dobírka either.
5. **Do not touch `backend/`.** If you believe a backend change is needed, stop
   and write it down for Matěj.
6. **E-mail templates are not yours.** They live in
   `backend/src/modules/resend/` and are finished. Your only overlap is §9 —
   the storefront pages those e-mails link *to*.
7. **Do not rename the routes in §9.** The backend builds e-mail links against
   them and has tests pinning the shapes. Renaming one breaks a live e-mail:
   the send still succeeds and the customer gets a 404.
8. **No new environment variables are needed.** The storefront's `.env.local`
   already has everything (`NEXT_PUBLIC_MEDUSA_BACKEND_URL`,
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_DEFAULT_REGION=cz`, the
   Packeta keys). If you think you need another, you have misread something.
9. Match the storefront's conventions — data fetching in `src/lib/data/`,
   components in `src/modules/`. Follow what is there.

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

Above the add-to-cart button, render:

- **„Vyrábí se na zakázku"** with the lead time — „Hotové za 14–42 dní".
- The deposit — „Nyní zaplatíte zálohu 25 % — {částka}. Zbytek doplatíte, až
  bude hotovo."
- A variant's `deposit_percentage_override` beats the product default when that
  variant is selected.

### 4.2 Product page: collect the specification

When `specification_required` is true, show a required textarea labelled with
`specification_prompt` and **block add-to-cart until it has content**. The
backend rejects an empty one, so your check saves the customer a round trip — it
is not the guard.

Send it as line-item metadata:

```ts
metadata: { made_to_order: { specification: "…" } }
```

### 4.3 Checkout: deposit or pay in full

`GET /store/carts/:id/production-payment-mode`

```jsonc
{
  "has_made_to_order": true,   // false → render nothing, ordinary cart
  "can_pay_full": true,        // false → deposit only
  "mode": "deposit",           // current choice
  "deposit_amount": 1500,      // charged now if deposit
  "full_amount": 6000,         // charged now if full
  "balance_later": 4500        // owed later under deposit
}
```

`POST` the same path with `{ "mode": "deposit" | "full" }`.

Two radio options, **deposit selected by default**:

- „Zaplatit zálohu {deposit_amount} — zbytek {balance_later} doplatíte, až bude
  hotovo."
- „Zaplatit rovnou celou částku {full_amount} — pak už nic neřešíte."

Render only when `has_made_to_order`; offer the second only when `can_pay_full`.
**Use the amounts as returned.**

### 4.4 Express checkout: the same choice

`src/app/[countryCode]/(express-checkout)/express-checkout/[handle]/page.tsx`
buys one product directly. If that product is made to order it needs the
specification field (§4.2) **and** the payment choice (§4.3) — otherwise express
checkout is a second route into the same broken path.

### 4.5 Account: pay an outstanding balance

An order with an unpaid balance shows **„Doplatit {částka}"**, linking to the
signed URL the customer was e-mailed. The e-mail already carries it; the account
page should not be a worse place to find it.

Both the amount and the link come from `GET /store/orders/:id/progress` (§8) —
`balance.outstanding` and `balance.payment_url`. The link is signed by the
backend and cannot be constructed client-side, so read it; never build one.

### 4.6 Handle the payment outcome

After a balance payment the backend redirects to:

```
/{countryCode}/order/{id}/confirmed?platba=paid|chyba|neplatny-odkaz
```

Read `platba` and show a short Czech message. Nothing else is required — the
payment is already recorded server-side; this is only how the customer finds out.

| `platba` | Message |
| --- | --- |
| `paid` | „Doplatek je zaplacený. Děkujeme!" |
| `chyba` | „Platbu se nepodařilo otevřít. Napište nám prosím." |
| `neplatny-odkaz` | „Odkaz na platbu už neplatí. Napište nám prosím." |

Without this, a customer completes a payment and lands on an ordinary order page
with no acknowledgement — which reads as *it did not work*, and the usual
response to that is paying twice.

## 5. TODO — personal collection, paid on arrival

### 5.1 Read this before you write any code

**The storefront already uses the word „pickup" for something else.**
`modules/checkout/components/shipping/index.tsx` splits shipping options with
`getFulfillmentType(option) === "pickup"`, which reads
`service_zone.fulfillment_set.type`. That split is for **Zásilkovna/Packeta
pickup points** — a carrier's parcel shop, with a map picker.

**Osobní odběr is not that.** The customer drives to the workshop and collects
from the owner, and may pay her there in cash. No carrier, no map, no parcel
shop, no dobírka.

Do not reuse the Packeta pickup-point picker, its metadata
(`packeta_pickup_point`), or its branch of that component. Identify Osobní odběr
by the **shipping option's provider id**:

| Thing | Exact id |
| --- | --- |
| Fulfillment provider (Osobní odběr) | `pickup_osobni-odber` |
| Payment provider (pay on arrival) | `pp_pickup_pickup` |
| Balíkovna / Česká pošta | `ceska-posta-fulfillment_balikovna` |
| Zásilkovna / Packeta | `packeta_packeta` |

### 5.2 Shipping step

Osobní odběr arrives as an ordinary shipping option. Show the workshop address
and that delivery costs nothing.

### 5.3 Payment step — the rule that matters

**„Zaplatím při vyzvednutí" is selectable only when the chosen shipping option
is Osobní odběr.** For every other shipping option it must not appear, and
switching away from Osobní odběr must clear it.

Add `pp_pickup_pickup` to `paymentInfoMap` in `src/lib/constants.tsx` — an
unmapped provider will not render. Title it „Zaplatíte při vyzvednutí". Never
„na dobírku".

The provider **authorizes and never captures**: the order is placed, and the
money is recorded when she hands the piece over. **Do not present the order as
paid.** Say „Zaplatíte na místě při vyzvednutí."

## 6. TODO — returns and complaints

The backend has a complete returns flow with **no storefront surface at all**
(zero references to `return-requests` in `storefront/src`). Today a customer has
no way to start one.

`POST /store/return-requests`

```jsonc
{
  "order_id": "order_…",
  "email": "…",
  "reason": "…",              // required, free text
  "customer_name": "…",       // optional
  "items": [ … ]              // optional
}
```

On submit the backend e-mails the customer a confirmation (`refund-request`) and
notifies the owner. When she decides, it sends `return-approved` or
`return-rejected` automatically — **you do not send anything.**

Add, on an order in the account: **„Vrátit zboží"** → a short form (reason
required) → a confirmation that she will be in touch. Status lives on the
request (`pending` / `approved` / `rejected`); surface it on the order if the
API exposes it, and if it does not, say so rather than inventing it.

## 7. TODO — notifications the customer can ask for

### 7.1 Restock — verify, do not rebuild

`POST /store/restock-subscriptions` exists and the storefront already references
restock in three files. **Verify it end to end** on a sold-out variant: the
sign-up succeeds and the customer is told they will hear. Finish it if it is
half-wired.

A variant with no availability must read **„Vyprodáno"** and offer the sign-up
instead of add-to-cart. Availability logic already exists in
`src/lib/util/availability.ts` — use it rather than writing a second rule.

### 7.2 Price drop — **no new UI; the wishlist is the subscription**

The backend watches prices daily (07:30) and e-mails anyone who has the product
in their **wishlist** when it drops. The wishlist is already fully integrated,
so this works today with no storefront change.

Do **not** add a separate „watch this price" control — it would be a second
subscription concept over the same mechanism.

The only thing worth doing: where the wishlist is explained, mention that saving
an object also means hearing about a price drop. Copy only.

## 8. TODO — order status in the account

`GET /store/orders/:id/progress` — **customer-authenticated** (session or
bearer). Returns 404, not 403, for an order that is not the caller's, so do not
distinguish those in the UI. Guest orders have no access; the e-mail carries a
signed link for the one action a guest can take.

```jsonc
{
  "stage": "working",                 // null on older orders — see below
  "stage_label": "Připravujeme",      // Czech, ready to display
  "stage_changed_at": "2026-08-05T…",
  "made_to_order": true,
  "balance": {                        // null when nothing is owed
    "outstanding": 4500,
    "currency_code": "czk",
    "payment_url": "https://…"        // signed; this is the §4.5 button
  }
}
```

**Display `stage_label` verbatim.** It is not a translation of the internal
stage name — the backend deliberately says „Chystáme k odeslání" for a packed
order rather than anything that reads as *already sent*, and „Čeká na platbu"
rather than „Problém s platbou". Re-wording these in the storefront undoes that.

`stage` is `null` for orders placed before the merchant workflow existed, and
for any order it has not picked up yet. That is normal, not an error. Fall back
to Medusa's own status:

| Backend state | Customer sees |
| --- | --- |
| not fulfilled, paid | „Přijato" |
| fulfilled, not shipped | „Zabaleno" |
| shipped | „Odesláno" |
| delivered | „Doručeno" |
| canceled | „Zrušeno" |

`balance` is where §4.5's „Doplatit {částka}" gets its amount and its URL. The
link is signed by the backend and cannot be constructed client-side.

Refresh on focus, not on a timer. These states change a few times over days; a
request every few seconds for that is waste.

## 9. Routes the e-mails link to — do not move these

The backend builds customer e-mail links against the routes below and has tests
pinning the shapes.

| Purpose | URL the backend sends | Status |
| --- | --- | --- |
| Order / „Vaše objednávka" | `/{cc}/order/{id}/confirmed` | exists |
| Product, review request, price drop | `/{cc}/products/{handle}` | exists — **by handle, not id** |
| Abandoned cart | `/{cc}/cart/recover/{cart_id}` | exists |
| Restock fallback | `/{cc}/store` | exists |
| Balance payment outcome | `/{cc}/order/{id}/confirmed?platba=…` | route exists, **param ignored — §4.6** |

`{cc}` is the country segment (`cz`, from `NEXT_PUBLIC_DEFAULT_REGION`).

A path without the country segment is *not* broken — `src/middleware.ts`
307-redirects and preserves the query string. A wrong **route name** is broken,
and no redirect rescues it. If you have a good reason to rename one of these,
say so: the backend link and its test change in the same commit.

## 10. Known backend gaps

**None blocking this work.** The two that existed when this brief was first
drafted — no store route for the merchant stage, and no way to reach the signed
balance link outside an e-mail — are both closed by `/store/orders/:id/progress`
(§8).

If you find a new one, write it in your log and say so in your report rather
than working around it. A workaround that writes state the backend cannot read
is worse than the gap.

## 11. Start here

1. Read this brief, then read `src/lib/data/` and `src/modules/` and match them.
2. Confirm the storefront builds clean before changing anything, so later
   breakage is attributable.
3. **§4 first, in order** — it is a broken purchase path.
4. Then §5 (read §5.1 before writing code), §6, §7, §8.
5. Keep a short log: what you did, what you could not, and anything here that
   turned out to be wrong about the current storefront.

## 12. Already done — do not rebuild

- **Wishlist** — integrated (~20 files). Also the price-drop mechanism (§7.2).
- **Reviews** — integrated (~15 files) including submission. The backend rejects
  a second review of the same product by the same customer, and more than three
  a day from one name; both return Czech messages meant to be shown verbatim.
- **Newsletter sign-up** — integrated. Unsubscribe is handled by the backend
  from a link in the e-mail; no storefront page needed.
- **ComGate payment** — working, in **test mode** (`COMGATE_TEST`), so payments
  are not real yet.
- **Zásilkovna / Balíkovna shipping** — working. Do not touch while adding §5.
- **Abandoned-cart e-mails** — a backend job; the recovery page already exists.
- **All transactional e-mails** — finished and wired. Not yours.

## 13. Reporting

When you finish, state: what you completed; what you could not and why; any
backend gap you found; and anything in this brief that turned out to be wrong.
Do not report something as working that you have not run.
