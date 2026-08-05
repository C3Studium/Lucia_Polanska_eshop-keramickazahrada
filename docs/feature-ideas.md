# Feature ideas — easing her workflow

Rewritten 2026-08-06 after Matěj's correction. The first draft mixed in
marketing and integrations; the brief is narrower and better: **every idea
must make her daily work easier, or the admin easier to learn.** Ideas that
serve selling instead are parked in the appendix so they are not lost, but
they are not the menu.

The test each idea has to pass: *name the moment in her day it removes.*

Effort: **S** = hours · **M** = a day-ish · **L** = several days.
Standing rules hold: never pay-later, never dobírka, Czech UI, A2 stays
numeric, automations only after approval.

---

## 1. Ráno — starting the day without thinking

**1.1 „Dnešek" — one list for the whole day — M**
*The moment:* she opens the admin and assembles her day herself — Denní
práce for orders, Zásoby for stock, Platby for problems.
*The change:* one tab that merges it: orders to move, pickups happening
today, balances that arrived overnight, stock that hit zero, e-mails that
failed. Each row is the same row from its home tab — no new concepts to
learn, just no assembly required. Done = the list is empty.

**1.2 Stage checklist hints — S**
*The moment:* „K odeslání" quietly implies weigh it, wrap it, label it,
and a forgotten step means unpacking.
*The change:* a short fixed hint under each stage column („Před odesláním:
zvážit · zabalit · štítek"), editable in Nastavení. Not a tracked checklist
— words in the right place at the right time.

---

## 2. Výroba — while her hands are in clay

**2.1 Photos + notes on the zakázka — S/M** *(previously A1)* ✅ built 2026-08-06
*The moment:* glaze recipes and progress live in a paper notebook that
doesn't know which order it belongs to.
*The change:* a drawer on the production order — photo + note, timestamped.
„Kobalt 2×, výpal 1240 °C" stays with the piece it describes.
*Workflow condition:* upload must work straight from the phone camera —
she photographs at the wheel, not at a desk.

**2.2 The customer watches — S, after 2.1** *(previously A2)* ✅ built 2026-08-06
*The moment:* „jak to vypadá?" e-mails interrupt her work.
*The change:* a per-photo „ukázat zákazníkovi" flag; flipped photos appear
on the customer's order page. The question answers itself before it is
asked. (This is customer-facing, but the work it removes is *hers*.)

**2.3 „Hotovo — podívejte se" with approve = pay — M** *(previously A3)* ✅ built 2026-08-06 (photo rides the balance e-mail; tweak requests land in the diary)
*The moment:* finishing a zakázka starts a correspondence: is it right, will
you pay the rest, can I ship it.
*The change:* one send. The customer sees the photo; approving **is** the
balance payment (the signed link already exists). One state on the
production order instead of an e-mail thread in her head.

**2.4 Customer reference images at order time — M** *(previously A4)*
*The moment:* deciphering „modrá jako u babičky" by e-mail ping-pong.
*The change:* the customer attaches inspiration photos with their
specification; she sees them in Zakázky next to the text.

**2.5 Promised date — S** *(previously A5)* ✅ exposed to customers 2026-08-06 (admin side already existed)
*The moment:* deadlines live in her memory; the existing deadline-watch job
can only warn about dates that were recorded.
*The change:* „slíbeno do" on the production order, shown to the customer,
watched by the job that already exists.

**2.6 Zakázka templates — M** *(previously A6)*
*The moment:* every „svatební sada" means re-typing the same prompt, lead
time and deposit floor.
*The change:* saved presets she picks from. Type it once, use it forever.

**2.7 Commission capacity — S/M** *(previously A7)*
*The moment:* success creates a queue her lead times can't keep, and she
has to *remember* to stop taking orders.
*The change:* „nejvýš N rozpracovaných zakázek" in Nastavení; at the limit
the storefront pauses new commissions with an honest message. The system
says no so she doesn't have to.

---

## 3. Balení a odeslání

**3.1 Split shipping for mixed orders — M** *(previously B1; designed)*
*The moment:* a paid mug waits three weeks in a box because the same order
contains a commission.
*The change:* „Odeslat skladové zboží" — partial fulfillment of the
non-zakázka lines (already fully paid under the deposit math; A2 gate
refined to check the shipped lines). Order stays in „Připravujeme" flagged
„částečně odesláno"; the customer gets one clear e-mail.

**3.2 Packing slip for the day — S** *(previously B2)*
*The moment:* packing day means the admin open on one screen and a
handwritten list on paper.
*The change:* select orders in Objednávky+ → one print page: per order the
items, address, carrier vs. pickup. Print stylesheet, no PDF machinery.

**3.3 Pickup time slots — M** *(previously A8)*
*The moment:* osobní odběr means „somewhen", which means being
interruptible all week.
*The change:* she defines windows (čt 15–18); the customer picks a slot
from the „připraveno k vyzvednutí" e-mail; Denní práce shows today's
pickups. Her week gets edges back.

---

## 4. Peníze a papíry — the part she does at the kitchen table

**4.1 Refund with a reason — S** *(previously D3)*
*The moment:* refunding through the native form, then keeping „why" in her
head.
*The change:* the refund asks one extra thing — a Czech preset (rozbité při
přepravě · dohoda · reklamace) — and records it on the order. Later, the
statistics can say why money went back.

**4.2 Podklady pro účetní — S** *(previously D4, „CSV export")*
*The moment:* the accountant asks for the quarter and she screenshots.
*The change:* „Stáhnout podklady" — date range → one file with orders,
sums, payments. An hour of work that removes a quarterly evening.

**4.3 Fakturoid — L** *(previously F1, reframed)*
*The moment:* every order still needs an invoice written somewhere else,
by hand.
*The change:* invoices create themselves from paid orders. This is the one
integration that is genuinely a *workflow* feature — it deletes a recurring
chore. Priced L because accounting correctness is not a side project.

---

## 5. Když se zákazník ptá — answering from the record, not from memory

**5.1 Message log on the order — S/M** *(previously D1)*
*The moment:* „Kontaktovat zákazníka" opens her mail app; a week later
nobody knows what was promised.
*The change:* the message sends through the shop (infrastructure exists)
and lands in the order's timeline next to the system e-mails. The
Objednávky+ expansion becomes the whole story of the order.

**5.2 Saved replies — S, after 5.1**
*The moment:* typing the same three answers — kdy to bude, jak zaplatit
doplatek, kde vyzvednout — again and again.
*The change:* a handful of Czech templates with the order's numbers filled
in. Two clicks instead of two paragraphs.

**5.3 One customer, one record — M** *(previously D5, „duplicate merge")*
*The moment:* the same person exists twice (guest order + later account),
so the Karta shows half a history and she answers from the wrong half.
*The change:* Zákazníci+ offers „sloučit" — pick the surviving record,
orders and wishlist and reviews move over. Transactional, hence M.

**5.4 Stock movement history — S** *(previously D2)*
*The moment:* „kam se poděly tři hrnky" is answered by memory.
*The change:* every add and correction is logged (when, ±how many); Sklad+
shows the trail. Confidence in the numbers is a workflow feature — she
stops recounting.

---

## 6. Snadné naučení — the admin teaches itself

**6.1 Onboarding cards — M** *(P11-2, skipped earlier; belongs here)*
First visit to each tab shows one dismissible card in her words: what this
tab is for, what to do first. Written against the §17 terminology rules.
Never shows again once dismissed.

**6.2 „K čemu to je?" — S**
A small „?" on every page reopening that tab's card on demand. The manual
lives where the work is, not in a PDF nobody finds.

**6.3 Undo for stage moves — M**
*The moment:* fear of clicking wrong is what makes software hard to learn.
*The change:* after a stage move (single or batch), the toast offers
„Vrátit zpět" for a few minutes — implemented as the legal reverse
transition where one exists, recorded in the timeline like any move. A
mistake that costs one click teaches; one that needs a developer scares.

**6.4 Plain-error pass — S**
Sweep every remaining error message for developer-speak; each must say what
happened and what to do next, in Czech. (Most already do; make it a test
like the terminology banlist so it stays true.)

**6.5 Global search — M**
*The moment:* finding order 1042 means knowing which page owns it.
*The change:* one search box (Ctrl/Cmd-K) over orders, customers and
products, jumping straight to the row. Learning where things live becomes
optional.

---

## The „don't build" list — unchanged, plus one

- **Kiln/firing planner** — one person, one kiln; a wall calendar wins.
- **Full loyalty program** — complexity without workflow relief.
- **Admin audit trail** — single user; the order timeline already answers it.
- **Multi-language** — no non-Czech customers yet.
- **Homegrown invoicing** — that's Fakturoid's job (4.3).
- **Instagram automation** — fragile, and her captions are the brand.

---

## If I had to pick the first three (updated to the brief)

1. **3.1 split shipping** — removes a weekly annoyance; design done.
2. **2.1 + 2.2 photos/notes with the customer flag** — moves her notebook
   into the order and stops the „jak to vypadá?" interruptions.
3. **1.1 „Dnešek"** — the whole morning in one list, nothing new to learn.

Then **6.3 undo** early, because it makes every other feature safer to try —
which is what „easy to learn" mostly means.

---

## Appendix — parked: selling & marketing ideas (different goal)

Kept only so they are not lost; none of these ease her workflow, and none
should be picked from this document: Heureka/Zboží.cz feed · third-order
thank-you discount · gift wrapping at checkout · „kolekce z výpalu"
scheduled drops · newsletter audience filters · photo reviews · „jak
vzniká" public gallery · certificates of authenticity. If selling becomes
the brief, these get their own document and their own prioritisation.
