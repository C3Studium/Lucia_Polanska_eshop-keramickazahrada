# Feature ideas — for Matěj to read and pick from

Written 2026-08-06 on request. Nothing here is being built; this is the menu.
Every idea is checked against what actually exists in the codebase, so
"builds on" names real modules and the effort estimates mean something.

Effort: **S** = hours · **M** = a day-ish · **L** = several days.
Standing rules apply throughout: never pay-later, never dobírka framing,
Czech UI, the A2 money gate stays numeric, automations ship only after
approval.

---

## A. The zakázka arc — the shop's actual moat

These belong together. A template shop cannot copy them, because they are
the shape of her craft: photos and notes while making → the customer watches
→ approves and pays → it ships. Each step alone is useful; the arc is the
feature.

### A1. Photos + notes on the production order — S/M
The drawer discussed before: `production_note` model
(`production_order_id`, `text`, `image_url`, `visible_to_customer` flag),
uploads via the existing minio-file module, drawer in Zakázky and the
Objednávky+ expansion. She records „kobalt 2×, výpal 1240 °C" and the photo
of the glazed piece, and it stays with the order.

### A2. Customer sees the making — S (after A1)
The `visible_to_customer` flag does the work: flipped photos appear on the
customer's order-progress page and can ride along on e-mails. The single
strongest justification for paying a deposit is *seeing your piece exist*.

### A3. Approval step: „Hotovo — podívejte se" — M
When she marks a zakázka finished, the customer gets the photo and one
choice: approve — which is the same click as paying the balance (the signed
pay link already exists) — or ask for one round of tweaks. New state on the
production order (`awaiting_approval`, `tweak_requested`), one e-mail
template, storefront page section. Turns the scariest moment of a
commission (did they make what I meant?) into a feature.

### A4. Customer reference images at order time — M
The mirror of A1: the customer attaches inspiration photos to their
specification during checkout (storefront upload → minio, item metadata
carries the URLs). She sees them in Zakázky next to the text spec. Cuts the
„could you describe that differently" e-mail round-trip.

### A5. Promised date — S
She sets/adjusts „slíbeno do" on the production order; the customer sees it
in order progress; the existing `watch-production-deadlines` job warns her
before it slips. Also unlocks honest stats later (promised vs. actual).

### A6. Zakázka templates — M
Recurring commission types („svatební sada", „jmenný hrnek") as presets:
pre-filled specification prompt, price range, lead time, deposit floor. She
stops re-typing the same profile; the storefront can list them as starting
points. Data model is a thin layer over the existing production profile.

### A7. Commission capacity — S/M
„Přijímám nejvýš N zakázek rozpracovaných najednou." A merchant setting;
when the count of active production orders hits it, the storefront shows
„zakázky znovu otevřeme, až dokončím ty rozpracované" instead of the order
form. Protects her lead times from her own success. Counting query exists.

### A8. Pickup time slots — M
Osobní odběr today means „somewhen". She defines windows (e.g. Thu 15–18);
the customer picks a slot at checkout or from the „připraveno k vyzvednutí"
e-mail; she sees the day's pickups in Denní práce. Needs a small slot model;
the pickup provider and the e-mail template already exist.

---

## B. Mixed orders and shipping

### B1. Ship the stock items now — M  *(discussed; designed)*
Partial fulfillment of non-zakázka lines, which are already fully paid under
the deposit math. A2 gate refined to compare captured against *the lines
being shipped*. Stage stays `working` with a „částečně odesláno" flag; one
customer e-mail. The best purely-operational feature on this list.

### B2. Packing slip / pick list for a shipping day — S
Select orders in Objednávky+ → one print-ready page: items per order,
address, pickup vs. carrier. No PDF library, just a print stylesheet. Pairs
with B1 and the batch stage moves that already exist.

### B3. Carrier tracking → delivery states — L
Poll Zásilkovna/Balíkovna tracking, flip orders to „doručeno" automatically,
and finally wire the `delivery-failed` template that exists with no sender.
Real value, but each carrier's tracking API is its own client — this is the
expensive one. (Balíkovna half is blocked on the ČP account anyway.)

---

## C. Selling — done with restraint

### C1. Heureka / Zboží.cz product feed — M
A czech shop without a Heureka feed is invisible to half its buyers. One XML
route over the catalog (title, price, availability, category mapping,
images). No new data — the catalog has everything. Highest
customers-per-hour-of-work on this list.

### C2. Věrnostní sleva — S
An automatic native promotion: from the third order, a small thank-you
discount. No points, no tiers, no program — just the promotion engine that
already runs, plus one rule. (A full loyalty program is on the „don't"
list.)

### C3. Dárkové balení + vzkaz — S
A checkbox and a message field at checkout (cart metadata, the pattern the
slider already uses); shows in Denní práce so she wraps it before packing.
Optionally a small fee via a shipping-option variant.

### C4. Limited drops — „kolekce z výpalu" — M
A dated drop: the seasonal-selection module already has scheduling and
end-behaviour; add a scheduled *start* (already proposed as automation #5)
and a storefront countdown. For a kiln-based shop, „nová várka v pátek v 18:00"
is the honest form of scarcity marketing.

### C5. Newsletter audiences — M
The campaign composer exists; add audience filters that reuse workbench
queries: repeat buyers, wishlist-holders of a product, everyone waiting on a
restock. „Vypálila jsem novou várku misek" to exactly the people who asked.

---

## D. Admin quality-of-life

### D1. Message log on the order — S/M  *(discussed)*
„Kontaktovat zákazníka" sends through the backend (existing notification
infra) and is logged on the order, so the Objednávky+ expansion shows the
whole correspondence trail, not just system e-mails. Mailto leaves no trace;
this does.

### D2. Stock movement history — S  *(discussed)*
Log every add/correction (when, how many, from where) at the additive
restock endpoint; show in Sklad+. Answers „kam se poděly tři hrnky" with
data instead of memory.

### D3. Refund with a reason — S
Native refunds work; wrap them with Czech reason presets (rozbité při
přepravě, dohoda, reklamace) recorded on the order, so Statistiky can later
say *why* money went back, not just that it did.

### D4. CSV exports — S
Orders and customers for the accountant: date range → CSV. Boring,
inevitable, an hour of work.

### D5. Duplicate-customer merge — M
Guest checkout + later registration under the same e-mail leaves two
records; wishlists/LTV split across them. A merge tool in Zákazníci+
(pick survivor, move orders/wishlist/reviews). Medium because moving
relations must be transactional.

---

## E. Trust and content

### E1. Photo reviews — M  *(discussed)*
Customer attaches a photo to a review; the moderation queue in Recenze
already exists, minio handles the upload. Ceramic photos from real kitchens
sell better than studio shots.

### E2. „Jak vzniká" gallery — M (after A1/A2)
Opt-in production photos become a per-product „proces" gallery on the
storefront. Content marketing from work she already did with her hands; zero
extra effort per product once A1 exists.

### E3. Certificate of authenticity — M
A print-ready certificate per zakázka (piece, materials, date, her mark) —
the same print-stylesheet approach as B2, no PDF library. Handmade shops
charge more with a certificate than without one.

---

## F. Integrations (each is its own decision)

- **F1. Fakturoid — L.** Czech invoicing done properly instead of homegrown
  PDF accounting. The only integration on this list I'd call *eventually
  mandatory* for a real CZ business.
- **F2. Heureka feed** — see C1 (it's an export, not a true integration).
- **F3. Instagram auto-posting — don't.** API pain, fragile, and her
  hand-written captions are part of the brand. A „copy caption + photo"
  helper in the admin would do more for less.

---

## G. Already proposed elsewhere (not repeated here)

The six automations in `admin-advanced-plan.md` — balance-reminder
escalation, auto-label on stage change, restock-demand digest, review nudge
window, seasonal-sale scheduled start, second abandoned-cart nudge — all
still parked awaiting approval.

---

## The „don't build" list — and why

- **Kiln/firing capacity planner** — one person, one kiln; a wall calendar
  wins.
- **Full loyalty program** (points, tiers) — C2 gives 90 % of the warmth at
  2 % of the complexity.
- **Admin audit trail** — single-user admin; the git log of her actions is
  the order timeline, which now exists.
- **Multi-language storefront** — until there's a single non-Czech order,
  it's cost without customers.
- **Homegrown invoice engine** — that's F1's job; accounting correctness is
  not a side project.

---

## If I had to pick the first three

1. **B1 — split shipping.** Fixes a real weekly annoyance; design is done.
2. **A1+A2 — photos/notes with the customer flag.** Small work, starts the
   arc, immediately differentiating.
3. **C1 — Heureka feed.** The cheapest new-customer acquisition available.

Then A3 (approval + pay in one click) as the follow-up, because it completes
what A1 starts and reuses the balance-link machinery.
