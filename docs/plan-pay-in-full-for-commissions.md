# Planned feature — let the customer pay a commission in full up front

**Status: design only. Nothing below is built.** Requested by Matěj alongside
the Přehled/Zakázky work; recorded now so the decisions are made before anyone
writes code, and so the storefront team has something concrete to build against.

## The problem

A made-to-order piece is currently always a two-payment transaction: a deposit
(default 25 %) at checkout, and a balance she requests by hand when the piece is
finished (D4). That is right when the customer wants it — a commission can take
six weeks and few people want to pay up front for something that does not exist
yet.

But some customers *would* rather pay once and forget about it. Today they
cannot, and the cost of that lands on her: a balance request to send, a payment
to chase, an overdue badge to notice, and an order that cannot ship until it
clears.

## What it changes

**Storefront (checkout):** when a cart contains a made-to-order product, offer a
choice — „Zaplatit zálohu {X} Kč" or „Zaplatit celou částku {Y} Kč". Deposit
stays the default; paying in full is opt-in.

**Admin:** a commission paid in full skips `awaiting_balance` entirely. It goes
`specification_pending → confirmed → in_production → ready_to_ship`, and the
Zakázky payment bar shows full from the start.

## Why this is not just "set deposit to 100 %"

Two things make it more than a percentage:

1. **The price can change after checkout.** Confirming a specification may raise
   the agreed total (§7.2 — that is exactly what the A2 ship gate exists to
   catch). A customer who paid „in full" at the old price is no longer paid in
   full at the new one, and the balance flow has to come back. So paying in full
   is a *starting position*, never a permanent state.
2. **The deposit percentage is per product** (`product_production_profile`), and
   a cart can mix a commission with ordinary stock. The choice is per *cart*,
   not per product, and only appears when the cart contains at least one
   commission.

## Proposed shape

### Backend

`POST /store/carts/:id/production-payment-mode` — sets `deposit` or `full` on
the cart, validating that the cart actually contains a made-to-order line.
Stored on `cart.metadata.production_payment_mode` (no migration).

The existing deposit calculation in the order-placed path reads that flag: when
`full`, the payment collection is created for the whole cart total and the
`production_payment_request` snapshot is written as `type: "deposit"`, amount =
total, so `productionOutstanding()` computes zero with no special-casing.

**That last part matters.** The ship gate, the Zakázky bar and the Přehled
„Čeká na doplatek" tile all derive from the same `agreed_total − paid` sum. If
paying in full is expressed as „a deposit that happens to equal the total",
every one of them is already correct and nothing needs a new branch. Introducing
a separate `paid_in_full` boolean would mean touching all of them, and any one
missed becomes a way to ship an unpaid order.

### Storefront

Needs from the store API, per cart:

```
GET /store/carts/:id  →  metadata.production_payment_mode
                          ("deposit" | "full", default "deposit")
```

and a summary the checkout can render without doing its own maths — deposit
amount, full amount, and which products are commissions. Cleanest is to extend
the existing store cart response rather than add an endpoint the checkout has to
call separately.

### Admin

- Zakázky card: „Zaplaceno předem v plné výši" chip when the deposit request
  equals the agreed total, so she knows not to expect a balance step.
- Product profile (`Produkty na zakázku`): a per-product toggle
  „Nabídnout zaplacení celé částky" — some pieces she may not want prepaid at
  all.

## Open questions for Matěj

1. **Refunds.** Someone who paid 6 000 Kč up front and cancels in week two is
   owed more than a deposit refund. D3 says deposit refunds are decided per
   case; does the same hold for a full prepayment, or should that always be
   refunded in full?
2. **Discount.** Prepaying is a favour to the shop — worth 5 %? That is a real
   business decision, not a technical one, and it changes the checkout copy.
3. **Does the choice survive a price change?** If she raises the price at
   specification confirmation, does a „paid in full" customer get a balance
   request like anyone else (recommended), or does she absorb it?

## Sequencing

Nothing here blocks the current phases. It touches the same code P6 rewrites
(the made-to-order actions route and the Zakázky page), so the cheapest time to
build it is **during or right after P6**, not before — doing it first would mean
writing the deposit logic twice.
