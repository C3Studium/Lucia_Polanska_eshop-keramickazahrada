# Keramická zahrada — interface system

Two surfaces, one owner, one audience rule.

- **Admin** (`backend/src/admin`) — Medusa v2 admin + our own Czech pages
  ("workbench" lists, Přehled, Denní práce). Built on `@medusajs/ui`.
- **E-shop** (`storefront/`) — Next.js, the atelier's own look (cream /
  near-black, clay accents, serif headings).

Measured 14. 11. 2026 at 1728×1117 (MacBook Pro 16), production data.

## Who uses this

- **Admin:** Lucie, the potter. 50+, not technical, opens the admin between
  kiln loads and packing. Her verbs: see what's waiting, pack and send, answer
  a customer, add a fired batch to stock, change a sentence on the web.
- **E-shop:** customers, many 50+, buying a gift or a garden piece. They read
  slowly, use reading glasses, and give up when they're unsure what happens
  next.

Feel: **calm and plain, like a workshop order book** — one thing to do per
screen, said in words, nothing hidden behind an icon.

## Audience floor (applies to every change, both surfaces)

These override style. If a design choice breaks one, the choice loses.

| Rule | Admin | E-shop (desktop) |
| --- | --- | --- |
| Running text | ≥ 14 px | ≥ 16 px |
| Labels, meta, captions | ≥ 13 px | ≥ 14 px |
| Nothing smaller than | 12 px (badges only) | 13 px |
| Text contrast | ≥ 4.5 : 1, links too | ≥ 4.5 : 1 |
| Tap/click target | ≥ 40 px tall, 44 for primary | ≥ 44 × 44 |
| Field labels | sentence case, above the field, never placeholder-only | same; no 11 px tracked caps |
| Inputs | boxed (visible border all round) | boxed or underline ≥ 1.5 px + focus ring |
| Actions | a verb in words ("Odeslat", "Uložit změny"); icon-only only with a visible tooltip and aria-label | same |
| Status | a word + colour, never colour alone | same |

Measured gaps against this floor (14. 11.): admin text is 12–13 px, sidebar
rows 28 px, row action links ("Rozbalit · Deník · Detail") 3.7 : 1. E-shop
cart and checkout text is mostly 11–12 px, quantity −/+ 26 × 27 px, delete
29 × 29 px, checkbox 24 × 24 px.

## Admin

- **Base:** `@medusajs/ui` tokens (`bg-ui-bg-base`, `text-ui-fg-subtle` …),
  Inter. Never hardcode greys; use `ui-fg-*` / `ui-bg-*` / `ui-border-*`.
- **Depth:** borders only (Medusa's). Cards = `Container`, 8 px radius. No
  shadows beyond what Medusa ships.
- **Page anatomy (keep):** title + one-sentence purpose → filter pills with
  counts → list rows → sticky `SaveBar` for edits. Expert mode toggle hides
  technical columns.
- **Focal point per page:** the list of things waiting. One dark primary
  button per page at most (e.g. "Naskladnit po výpalu", "Nový termín").
- **Row actions:** the action that moves the row forward is a button; the
  rest go under "…". Links-as-actions only for navigation.
- **Words:** Czech everywhere. Medusa's own English screens (order detail
  cards "Summary", "Payments", "Unfulfilled Items", "Capture payment") are
  known gaps — translate or wrap, don't add more.
- **Navigation truth:** the sidebar item that is highlighted must be the
  page you are on (today "Sklad" opens Přehled → Zásoby and highlights
  Přehled).

## E-shop

- **Type:** Sentient (serif) for headings and prices, Sansation for UI and
  body. Headings large and quiet; body never Light weight below 16 px.
- **Colour:** cream `#f1ebe0`-ish page / near-black panels / peach cards for
  totals, clay family (`--clay-*`) for accents. Accent means action or
  status, not decoration.
- **Labels:** the tracked uppercase micro-labels ("CENA ZA KUS:",
  "JMÉNO (POVINNÉ)") are the brand's voice — keep them for section eyebrows
  only, at ≥ 13 px; field labels become sentence case ≥ 14 px.
- **Checkout:** steps keep their numbers *with names* (1 Adresa · 2 Doručení
  …), never bare circles. One primary button per step, full width, ≥ 52 px.
- **No animation in the shop** (PlainShop rule, 13. 11. 2026).
- **Listing order:** what can be bought comes first; "Prodáno" never leads
  the default sort.
