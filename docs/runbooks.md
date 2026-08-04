# Runbooks

What to do when something goes wrong, written for the person holding the pager
rather than the person who wrote the code (P12-3).

Each one starts with **how you find out**, because the hardest part of an
incident is usually noticing it.

---

## 1. A customer says they never got an e-mail

**How you find out:** they phone. Or **Přehled → Nezdařené e-maily** shows a
count.

1. Open the **order**, scroll to **„Odeslané e-maily"**. That lists everything
   ever sent about it, with status.
2. If the row is there and green, it left our side. Ask them to check spam —
   and note the address on the row, because a typo at checkout looks identical
   to a delivery failure from here.
3. If the row is **red**, click **Poslat znovu**. If it fails again it shows
   Resend's own reason. The common ones:
   - `validation_error … domain is not verified` — the Resend sending domain
     needs verifying. Ours, not theirs.
   - `missing_api_key` / `restricted_api_key` — `RESEND_API_KEY` is wrong or was
     rotated.
   - `rate_limit_exceeded` — wait, then retry.
4. If the row is **absent entirely**, the e-mail was never attempted. That means
   the event did not fire — check the server log around the order's timestamp.

**Why there is no „reason" column:** the notification record stores a status,
not an error. The reason lives in the server log and in what a retry reports.

---

## 2. A parcel is stuck — „Čeká na ruční podání zásilky."

**This is normal, not a fault.** With no carrier account configured, packing an
order records the parcel but tells Česká pošta nothing. The order waits until
you confirm you have handed it over.

1. Book the parcel in the ČP portal as usual.
2. In **Denní práce → K odeslání**, click **„Zásilku jsem předala dopravci"**.
3. That — and only that — sets the order to Odesláno and sends the customer's
   e-mail.

If you click it twice, the second says „už je předaná" and does nothing.

**To make this one click again:** connect the carrier account
(`docs/TODO-carrier-account.md`).

---

## 3. A payment is stuck — customer says they paid, the shop disagrees

**How you find out:** they tell you, or the commission sits in „Čeká na
doplatek" longer than it should.

1. **Wait 30 minutes first.** `reconcile-balance-payments` asks ComGate directly
   every half hour and fixes exactly this — the callback that never arrived. If
   the money is real, the commission moves on its own and you get a bell entry
   saying the confirmation was late.
2. If it has not moved after an hour, check the ComGate portal for the
   transaction.
   - **Paid in ComGate, not in the shop:** the reconciliation could not match
     it. Capture the payment on the native order page, then treat it normally.
   - **Not paid in ComGate:** they did not complete it. Use **„Požádat o
     doplatek"**, or **„Připomenout doplatek"** if a link already exists — that
     re-sends the same link rather than creating a second one.
3. Expired links are marked automatically and you get a notification. A new
   request creates a fresh link.

**Never** mark an order paid to make it go away. The ship gate is the only thing
standing between the shop and posting goods it was not paid for.

---

## 4. „Vytvořit zásilku a odeslat" failed

**How you find out:** a red line on the order row, a toast, and a bell entry
(the technical detail goes to `DEV_NOTIFICATION_EMAIL`).

The order **stays** in K odeslání and nothing was half-done — the workflow
refuses before touching stock. Read the reason on the row:

| Reason | What it means |
| --- | --- |
| „Objednávka není celá zaplacená" | Money is genuinely missing. Not a bug. |
| „Na objednávce probíhá úprava" | An order edit is open. Finish or cancel it on the native page. |
| „U objednávky čeká nezaplacená platba" | A payment link is open. Wait or cancel it. |
| „Zakázka není doplacená" | Commission balance outstanding. |
| No stock location / shipping method | The shipping option is not wired to the workshop location. Settings → Locations. |

Retrying is always safe: an existing fulfilment is reused rather than
duplicated.

---

## 5. Orders are missing from Denní práce

**How you find out:** a banner on Denní práce saying how many.

Click **Načíst**. It only creates rows for orders that have none, so running it
twice is safe and the second run reports zero. Cancelled orders land in the
cancelled outcome rather than reappearing in Nové.

---

## 6. Stock numbers look wrong

Availability here is **stocked − reserved**. A piece reserved for a paid order
is not sellable, so „6 on the shelf, 5 reserved" correctly reads as 1 available.
The Sklad pages show all three numbers for exactly this reason.

If a piece is stuck reserved with no matching open order, the reservation
outlived its order — check Sklad → Rezervace on the native page.

---

## 7. The daily jobs did not run

All scheduled work is visible in the server log by name:

| Job | When | What it does |
| --- | --- | --- |
| `watch-stock-levels` | 07:00 | low / sold-out alerts |
| `send-daily-summary` | 07:05 | the morning e-mail |
| `watch-production-deadlines` | 07:10 | commission deadlines, quiet balances |
| `request-reviews` | 10:00 | one review ask per order |
| `reconcile-balance-payments` | every 30 min | asks ComGate what really happened |
| `watch-failed-emails` | every 15 min | raises failed sends |
| `retire-sold-out-clearance` | hourly | hides sold-out výprodej pieces |
| `close-finished-sales` | 00:10 | archives finished sales |

Every one is keyed by day or by record, so a missed run catches up on the next
pass and nothing double-sends. A restart is not an incident.

---

## 8. Something is on sale that should not be

Check **Přehled → Slevy a akce** — it lists all four discount instruments at
once, which is the only place that answers „what is discounted right now?".
Status comes from the dates, so an expired sale reads as ended even before the
nightly job archives it.

Editing happens where each was created: seasonal sales in Sezónní akce, codes
and automatic discounts in Propagace, price lists under the hidden Ceníky.
