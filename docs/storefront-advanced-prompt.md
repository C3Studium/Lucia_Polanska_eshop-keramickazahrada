# Storefront brief 2 — the deposit slider

Continuation of `storefront-implementation-prompt.md`. Everything there still
holds (ground rules, provider ids, route contract, reporting). This brief
covers one feature the backend has just grown, and it **changes §4.3 of the
first brief**: the two-radio deposit/full choice becomes a slider.

## 1. What changed and why

The owner's rule for commissions is now: **the customer chooses how much to
pay at checkout.** Not whether — how much. There is no „pay later" and there
never will be; the choice runs from the owner's per-product minimum (her
materials are always covered) up to the full price (then there is nothing to
solve later).

The backend enforces this. The slider you build is a courtesy for choosing a
number — the server clamps and validates, and the amounts you display always
come from the API, never from your own arithmetic (first brief, rule 3).

## 2. The API

`GET /store/carts/:id/production-payment-mode` — unchanged fields plus one new
block:

```jsonc
{
  "has_made_to_order": true,
  "can_pay_full": true,
  "mode": "deposit",           // "deposit" | "full" | "custom"
  "deposit_amount": 1500,      // charge-now at the owner's minimum
  "full_amount": 6000,         // charge-now at the top
  "balance_later": 4500,       // owed later under the minimum
  "custom": {                  // null when the cart has no commission
    "minimum": 1500,           // slider floor — the owner's rule, in money
    "maximum": 6000,           // slider ceiling
    "amount": 1500             // current position under the stored choice
  }
}
```

`POST` the same path:

```jsonc
{ "mode": "custom", "amount": 3200 }   // the slider position, charge-now total
{ "mode": "deposit" }                   // preset: the minimum
{ "mode": "full" }                      // preset: everything
```

An `amount` outside `[minimum, maximum]` is a **400** with a Czech message —
show it verbatim. Do not pre-clamp silently on your side; snap the slider
control to the bounds so an illegal value cannot be *submitted*, but if the
server ever rejects, the server's message wins.

Notes that matter:

- `custom.maximum` can be **less than the cart total** — a product that
  forbids full prepayment caps how much can be routed to it. Never compute
  the ceiling yourself; read it.
- After any cart change (item added, removed, quantity), **re-GET**. The
  bounds move with the cart, and a stale slider showing yesterday's range is
  showing wrong money.
- `balance_later` under a custom amount is `full_amount − amount` — but
  display what a re-GET returns rather than subtracting locally.

## 3. The UI

One slider, in the checkout where the two radios were (and in **express
checkout** — same rule, same component):

- Range `[custom.minimum, custom.maximum]`, stepped to whole korunas.
- Endpoints labelled: „Záloha {minimum}" and „Celá částka {maximum}".
- Under the slider, always two lines, updating as it moves:
  - „Nyní zaplatíte **{amount}**."
  - „Po dokončení doplatíte **{zbytek}**." — or „Pak už nic neřešíte." at the
    top end.
- Default position: **the minimum**. The owner's floor is the default choice,
  not a nudge toward paying more.
- POST on release/change (debounced), then render from the response.

Copy rules: „záloha" for the minimum, „doplatek" for the remainder — the same
words the e-mails and the admin use. Never „splátky", never anything that
reads as credit or pay-later; this is prepayment of a commission, not
financing.

When `has_made_to_order` is false: render nothing, exactly as before.

## 4. What this replaces

The §4.3 radios from the first brief. If you built them already, the slider
supersedes them; `mode: "deposit"` and `mode: "full"` still work and now act
as presets, so a gradual swap is safe. The specification field (§4.2), the
`?platba=` outcome handling (§4.6) and the account balance button (§4.5/§8)
are untouched.

## 5. The making-of on the order page (new, small)

`GET /store/orders/:id/progress` gained two fields:

```jsonc
{
  "promised_at": "2026-09-15T…",   // „slíbeno do" — null until she sets it
  "making": [                       // photos/notes she chose to share, newest first
    { "text": "Glazura nanesena.", "image_url": "https://…", "at": "…" }
  ]
}
```

On the order page, when `making` is non-empty, render a small „Jak vzniká"
section — photos with their dates, text under each where present. When
`promised_at` is set, show „Hotové nejpozději {datum}". Both are per-order
trust builders; keep them quiet and unstyled-luxury, not a gallery feature.
No writes, no new endpoints, nothing to build if the array is empty.

One optional write exists: `POST /store/orders/:id/request-tweak` with
`{ "message": "…" }` (customer-authenticated, own order only) — „Prosím o
úpravu" under the making-of section when a balance is outstanding. 201 with a
Czech confirmation; repeated sends within a day return 200 with a polite
„už to máme". Do not build any other feedback channel.

## 6. Not in scope

- **No pay-later, ever** — not as UI, not as copy, not as a zero-minimum
  edge case. The backend never returns `minimum: 0`; if you ever see one,
  stop and report it as a backend bug.
- **Restock demand counts** („X lidí čeká") exist in the backend but are an
  admin instrument. Do not surface them to customers without an explicit
  go-ahead from Matěj.
- Admin workbenches (`/admin/workbench/*`) are internal; nothing for the
  storefront there.

## 7. Reporting

As in the first brief: what you completed, what you could not and why, and
anything here that turned out wrong about the storefront as it stands.
