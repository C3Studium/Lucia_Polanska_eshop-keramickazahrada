# Storefront V2.0 — implementation log

Append-only record of the storefront refinement pass (`feat/storefront-v2`).
Specification: `StorefrontDesignOptimization.md` · Rules of engagement: `docs/opus-storefront-prompt.md`.
The backend session owns `docs/implementation-log.md` — nothing here is written there.

Format per task: **files** · **what/why** · **deviations** · **gate** · **notes for Matěj**.

---

# ⚠ Open items — everything that needs Matěj's attention

Living index, kept current as tasks land. Each item names where it came from; the per-task entry
below has the detail. **Nothing here blocks further storefront work** — every item was either
implemented under a stated assumption or shipped in an honest interim state.

## 1. Decide / confirm — these change what ships

| # | Item | Why it needs you | Raised in |
|---|---|---|---|
| **O-1** | **Confirm the bank account.** `/doprava-a-platba` carried **three different account numbers** (2500675505/2010, 7010757121/2010, 2701281289/2010), two of them paired with an IBAN belonging to a fourth combination. A bank-transfer customer could have paid an account that is not yours. All sites now read **7010757121/2010** / `CZ34 2010 0000 0070 1075 7121` — the value in `.env.local`, confirmed by the IBAN checksum. **If any other number was the live one, say so before this reaches production.** | Money goes to the wrong place if this is wrong | A5 |
| **O-2** | **Legal texts reviewed for accuracy, not sufficiency.** Another company's boilerplate is gone, but the privacy policy still reads as generic corporate text ("Jsme společnost…", "Společnostmi v rámci naší skupiny") for what is a sole trader. Worth a lawyer's eye before launch. | Out of an engineer's scope | A5 |
| **O-3** | **Order of `placeOrder` and `capturePayment`** on the confirmed page: they fire concurrently. Pre-existing, deliberately not reordered — capture-then-complete may be correct, but that is a payment decision needing the backend's view. | Needs backend session input | A6 |
| **O-4** | **Consent text wording.** The terms checkbox added before payment states agreement with obchodní podmínky and acknowledgement of the privacy policy, and records the moment of consent. Confirm the wording is what your lawyer wants recorded. | Legal record of consent | A7 |

## 2. Waiting on you to supply something

| # | Item | What to do | Raised in |
|---|---|---|---|
| **O-5** | **Reklamační protokol PDF.** The page ships a clearly-marked placeholder instead of a download button that would 404. | Drop the PDF into `public/dokumenty/` and set `PROTOCOL_PDF_PATH` in `(main)/reklamacni-protokol/download.tsx`. Nothing else changes. | A5 (D-S6) |
| **O-6** | **Contact endpoint.** The dialog is built against the D-S1 contract and is switched off, showing direct contact details instead. | When `POST /store/contact` is live, set `NEXT_PUBLIC_CONTACT_FORM_ENABLED=true` on Railway. | A4 (D-S1) |
| **O-7** | **Newsletter platform.** Parked by D-S1. The footer shows one line and a `mailto:` — no inert form. | Pick a platform; the mailto line is the only thing to replace. | A3 |

## 3. Backend work the storefront is waiting on

| # | Item | Detail | Raised in |
|---|---|---|---|
| **O-8** | **Medusa seed data must be deleted.** Four categories (Shirts, Sweatshirts, Pants, Merch) and their demo apparel products are starter data. Per your instruction they are excluded storefront-side **as a temporary measure**. | `SEED_CATEGORY_HANDLES` in `src/lib/data/navigation.ts` is the only hand-filter in the codebase. **When the backend admin work removes the seed data, delete that constant and the `.filter()` that uses it.** The demo *products* are still reachable in `/store` and its filter panel — that cleanup is backend-side. | A2 |
| **O-9** | **No collections exist** (0 collections, 12 categories). The menu falls back to categories and will switch to collections automatically if you create them. Nothing to do unless you want collections. | — | A2 |
| **O-10** | **Pickup point on the order e-mail.** The Review step now shows the Zásilkovna point before payment; putting it on the confirmation e-mail is backend-side. | Coordinate with the backend session | A7 |

## 4. Known-unverified / deferred

| # | Item | Status | Raised in |
|---|---|---|---|
| **O-11** | **Playwright e2e never run.** `pnpm test-e2e` needs a running backend. | Provide a backend URL and it runs at a phase end. Deferred, not skipped. | all tasks |
| **O-12** | **Confirmed-page failure branch reviewed by reading, not exercised.** Triggering it needs a real cart whose completion fails. | Flagged rather than claimed as tested | A6 |
| **O-13** | **Review step verified with a mocked cart, not a live purchase.** A real end-to-end ComGate purchase has not been made from this branch. | Needs a test order against the live backend | A7 |
| **O-14** | **Scrollbar rail overlaps the open mega-menu** and swallows pointer events over the sixth card's right edge. Pre-existing. | Belongs to Phase D's scrollbar re-engineering (spec §4, §11.7) | A2 |
| **O-15** | **`next lint` is deprecated**, removed in Next 16. Not in any phase. | Follow-up ticket: `npx @next/codemod@canary next-lint-to-eslint-cli .` | baseline |
| **O-16** | **Pre-existing hydration mismatch on `/dotazy`**, originating in `DotazyMain`. Unrelated to this work, pre-dates it. | Candidate for Phase C's page work | A3 |

## 5. Working notes

- **Never run `pnpm build` while `pnpm dev` is running.** Both write the same generated stylesheet
  (trap 1) and it corrupts `.next`; the dev server then serves 404s for its own CSS and pages
  render unstyled, which looks exactly like a CSS regression. Fix: `rm -rf .next`, restart.
- Local, uncommitted QA helpers live in `storefront/qa-*.mjs` (Playwright screenshots at
  1024/1280/1536 + reduced motion). They are listed in `.git/info/exclude`, not in the repo.
- `pnpm exec playwright install chromium` was run once to make the visual gate possible.

---

## Baseline — 2026-08-04

**Setup deviation (worth knowing).** The session was launched in the *main* working tree on
`feat/admin-operating-plan` (the backend session's branch, with its uncommitted work in
`backend/`), not in the worktree §0 of the brief describes — that setup had not been run.
Rather than work in the backend session's tree (D-S2, trap 16), the documented §0 setup was
executed verbatim from this session:

```
git worktree add ../keramicka-storefront-v2 -b feat/storefront-v2 main
cp StorefrontDesignOptimization.md docs/opus-storefront-prompt.md storefront/.env.local  →  worktree
cd storefront && pnpm install
```

Nothing in the main working tree was modified; the backend session's uncommitted changes are
untouched. All subsequent work happens in `/Users/matejforejt/Documents/GitHub/keramicka-storefront-v2`
on `feat/storefront-v2`.

**Environment**

| | |
|---|---|
| Node | v24.4.1 |
| pnpm | 10.14.0 (`packageManager` pins 10.11.1; install ran on 10.11.1) |
| Next.js | 15.5.21 |
| Branch point | `main` @ `1b599d7` |

`pnpm install` reported ignored build scripts (`@parcel/watcher`, `esbuild`, `sharp`,
`unrs-resolver`) — matching the main tree's setup; the build is green without them.

**Baseline gate — `pnpm lint && pnpm build`: GREEN**

- `pnpm lint` → exit 0. 9 warnings, no errors: 6 × `react-hooks/exhaustive-deps`
  (`useDimension.ts`, `context/cart.tsx` ×2, `context/region.tsx`, `shipping-address`),
  2 × `@next/next/no-img-element` (`payment-container`, `comgate-payment-selector`),
  2 × `import/no-anonymous-default-export` (Sanity schema types).
  `next lint` itself is deprecated (removed in Next 16) — flagged below.
- `pnpm build` → exit 0. `sync:styles` synced 154 style files (31 global emitters);
  compiled in 53 s; 966 static pages generated against the live Railway backend.
  Shared first-load JS 103 kB; `/studio` route 1.61 MB (Sanity Studio, dev-facing).
  Build-time noise (non-fatal, pre-existing): repeated `Failed to fetch wishlist items:
  Dynamic server usage` on `/[countryCode]/products/[handle]` during static generation.

**Observations recorded at baseline** (not yet acted on; each belongs to a numbered task)

- A **second** 0-byte file exists beyond the one the audit names: `src/app/api/reset-password/route.ts`
  is also empty, alongside `src/app/[countryCode]/smluvni_podminky/page.tsx`. Both build without
  error but neither exports anything. Handled with A3's route hygiene.
- Merchant identity values are in `.env.local` **without** the `NEXT_PUBLIC_` prefix
  (`IDENTIFIKACNI_CISLO`, `SIDLO_ADRESA`, `CISLO_UCTU`, `IBAN`, `SWIFT_KOD`, `INTERNETOVA_ADRESA`),
  so the `"use client"` Footer cannot read them directly. A3 will read them server-side and pass
  them down rather than re-declaring them as public env vars.
- Contact details already present in the codebase and consistent across four call sites:
  `info@keramickazahrada.cz` · `+420 775 211 578` · Putim 229, 397 01 Písek · IČO 03441482.
- **Legal-entity contradiction to resolve in A5:** `smluvni-podminky/data.ts` names
  *"Lucie Polanská, se sídlem Putim 229, 397 01 Písek, identifikační číslo: 03441482"* (a natural
  person), while `odstoupeni-od-smlouvy/page.tsx:27` names *"Keramická Zahrada s.r.o."* (a limited
  company). These cannot both be the seller. Question for Matěj queued below.

**Notes for Matěj**

1. Which legal entity is the seller — *Lucie Polanská, IČO 03441482* or *Keramická Zahrada s.r.o.*?
   Every legal page, the footer identity block and the order e-mails must name the same one.
   A5 is blocked on this for wording only; A3's footer will use the env values meanwhile.
2. `next lint` is deprecated and disappears in Next 16. Not in scope for any phase; worth a
   follow-up ticket (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
3. e2e deferred — `pnpm test-e2e` needs a running backend; will run at phase ends when a backend
   URL is provided.

**Gate:** lint ✅ · build ✅ · visual QA n/a (no UI change).

---

## A1 — `lang="cs"` + Czech metadata sweep (spec §14 P0 item 0.1)

**Files**

- `src/app/layout.tsx` — `lang="en"` → `lang="cs"`; root `title.default` + `title.template`
  (`"%s | Keramická zahrada"`) and a Czech default description.
- Not-found surfaces, all four: `src/app/not-found.tsx` (was fully English in body copy too),
  `(express-checkout)/not-found.tsx` (same), `(main)/not-found.tsx`, `(checkout)/not-found.tsx`,
  `(main)/cart/not-found.tsx` — titles "404"/"Something went wrong" → Czech.
- Auth + account: `@login` ("Sign in" / "Sign in to your Medusa Store account."),
  `forgot-password` (Slovak → Czech, "Medusa Store" → Keramická zahrada), `verify-email`
  (English), `@verifyEmail`, `reset-password` ("Keramická Zahrada" casing).
- Checkout: `(checkout)/checkout/page.tsx` "Checkout" → "Pokladna".
- Payment states: `cart/[id]/confirmed` and `cart/[id]/pending` — both carried
  `"Order Confirmed" / "You purchase was successful"`; pending now says it is waiting for
  confirmation (its body is rewritten in A6).
- Suffix de-duplication now that the template supplies the brand: `(main)/page.tsx`
  (`title.absolute`), `kurzy`, `dotazy`, `vyroba`, `o-mne`, `products/[handle]`.
- `products/[handle]/page.tsx` — description was `product.title` repeated; now the product's
  subtitle/description trimmed to 160 chars on a word boundary via a local `summarize()` helper,
  with a Czech fallback. Brand casing normalised to "Keramická zahrada".
- Metadata added where there was none: `store` and the five legal pages.

**What / why.** `<html lang="en">` on a Czech store is the SC 3.1.1 failure the spec opens with —
screen readers apply English phonetics to Czech copy and browsers offer to translate the page.
The metadata sweep removes the remaining "Medusa Store" / "Sign in" / "You purchase was
successful" / Slovak leftovers a customer sees in their tab and in search results. The root
template means no page can silently ship an unbranded or English title again.
`[trust]` `[accessibility]` `[clarity]` `[maintainability]`

**Deviation — legal pages converted from client to server components.** The five legal pages
(`cookies`, `smluvni-podminky`, `ochrana-osobnich-udaju`, `odstoupeni-od-smlouvy`,
`doprava-a-platba`) were `"use client"`, which forbids `export const metadata`. Each was only a
data array plus a render of the client `LegalDocument`, with no hooks or handlers, so `"use client"`
was dropped. This is the minimal way to give them titles, and it moved their text off the client
bundle: **7.76 kB → 142 B route JS, 165 kB → 157 kB first load, per legal page.** `LegalDocument`
itself is untouched and still a client component, so the animation and scroll behaviour are
unchanged (verified visually). `[performance]` alongside the intended `[trust]`.

**Not done here (deliberate).** `collections/[handle]`, `categories/[…]`, `search` and
`results/[query]` are `permanentRedirect` stubs — metadata on them would never render. The three
express-checkout pages have no metadata of their own and now inherit the Czech root default;
their own titles belong to the express-checkout pass.

**Gate**

- `pnpm lint` → exit 0 (same 9 pre-existing warnings, none new).
- `pnpm build` → exit 0.
- Visual QA: dev server at 1024/1280/1536 px plus a `prefers-reduced-motion` pass. The two most
  at-risk pages (`smluvni-podminky`, `cookies` — the server-component conversion) render pixel-wise
  as before; no console errors, no failed requests. `lang="cs"` and the intended `<title>` verified
  by HTTP on 12 routes: `/`, `/store`, all five legal pages, `/dotazy`, `/kurzy`, `/vyroba`,
  `/o-mne`, `/cart`.
- e2e deferred (no backend URL for Playwright e2e; the storefront's own dev server runs against
  the live Railway backend, which is what the visual QA used).

**Notes for Matěj**

- A local QA harness (`storefront/qa-shot.mjs`, Playwright screenshots at the three desktop widths
  + reduced motion) is **not committed** — it is listed in `.git/info/exclude`. That exclude file
  is shared with the main working tree; the entry is inert there.
- `pnpm exec playwright install chromium` was run once to make the visual gate possible.

---

## A2 — real catalogue data in the Produkty menu (spec §14 P0 item 0.2, trap 10)

**Files**

- `src/lib/data/navigation.ts` — **new.** `listNavigationCollections()` builds the mega-menu from
  the catalogue.
- `src/app/[countryCode]/(main)/layout.tsx` and `(checkout)/layout.tsx` — both hardcoded
  `navigationCollections = []` (trap 10); both now call the helper. The main layout's 30-line
  commented-out draft of this logic is deleted, superseded by the helper.
- `src/modules/layout/Navbar/productsButton/index.tsx` — `hardcodedCollections` ("Kolekce 1…6",
  36 fake category links, all pointing at `/store`) deleted along with the fallback that
  substituted it whenever real data was empty.
- `src/modules/layout/Navbar/index.tsx` — passes `hasMenu`.

**What / why.** Every entry in the "Produkty" mega-menu was invented: six cards titled
"Kolekce 1"…"Kolekce 6", each with six links labelled "kategorie", every one of them navigating
to an unfiltered `/store`. It is the first thing a customer opens and the clearest signal in the
spec's "prototype seams shipped to production" list. The menu now shows six real categories with
their own product photography, each filtering the catalogue. `[trust]` `[conversion]` `[usability]`

**Deviation — the audit assumed collections; the backend has none.** Verified against the live
backend: `/store/collections` returns **0**, `/store/product-categories` returns **12**. The
commented-out code in the layout said as much ("Re-enable once collections and their products
exist in Medusa"). Implementing the spec's intent — real, navigable destinations — the helper
prefers collections when they exist and falls back to top-level **categories** when they do not.
No behaviour changes for the editor when collections are eventually created.

**TODO(backend) — seed data.** Four of the twelve categories are Medusa starter data
(Shirts, Sweatshirts, Pants, Merch, one demo apparel product each). Per Matěj (2026-08-04) these
exist only because the backend is not finished, and the storefront should proceed and flag it:

> **This must be revisited once the new backend admin work is complete.** The storefront
> excludes those four handles in `SEED_CATEGORY_HANDLES` (`src/lib/data/navigation.ts`), which is
> the single place the catalogue is filtered by hand. When the seed data is deleted from Medusa,
> **delete that constant and the `.filter()` that uses it.** The demo *products* are still
> reachable in `/store` and its filter panel — that cleanup is backend-side and is not something
> the storefront should paper over.

**Bug found and fixed during visual QA.** The card links were built as `/store?collection=<handle>`
by a presentation-layer helper. With categories in the cards, that parameter resolves against a
different backend lookup and silently returned the *unfiltered* catalogue. The destination is now
built in the data layer, which knows what each entry is (`catalogueHref("category" | "collection")`),
and `NavigationCollection`/`NavigationCategory` carry a ready `href` instead of a raw `handle`.
Verified end to end: the first card leads to a catalogue reading "Prohlédnout 14 originálů",
matching that category's product count in the backend exactly.

**Also in this task**

- With no navigation data at all, "Produkty" no longer opens an empty panel — it becomes a link
  to `/store`. A control that opens nothing is worse than a link.
- A card without sub-categories used to offer "Všechny produkty" → unfiltered `/store`, throwing
  away the customer's context. It now reads "Zobrazit vše" and keeps the card's own filter.
- The card eyebrow read "Kolekce 01" on what is a category; it is now the archival numeral alone.
- Removed `usePathname`/`useRouter` from `CollectionList`: both fed a `currentCollection` lookup
  used only by commented-out JSX, and matched `/collections/<handle>` routes that are now
  redirect stubs. The commented block itself is left untouched. `[performance]` (a persistent
  navbar component no longer re-renders on every route change)

**Gate**

- `pnpm lint` → exit 0, no new warnings. `npx tsc --noEmit` → clean.
- `pnpm build` → exit 0.
- Visual QA at 1024/1280/1536: menu opens with six cards — Zvonková tlačítka, Do zahrady a na
  fasádu, Do bytu a do kuchyně, Květiny, Dárkové poukazy, Zakázková Výroba — each with real
  photography from its own products. Card expansion, stagger and vertical titles unchanged.
- e2e deferred (no backend URL provided for the Playwright suite).

**Notes for Matěj**

1. **Dev-server hazard worth knowing:** running `pnpm build` while `pnpm dev` is running corrupts
   `.next` — the dev server then serves 404s for its own CSS chunks and pages render unstyled,
   which looks exactly like a CSS regression. Both commands run `sync:styles` over the same
   generated sheet (trap 1). Fix is `rm -rf .next` and restart; the working habit is to never run
   them concurrently.
2. **Pre-existing interaction defect, logged not fixed:** the section-rail scrollbar
   (`layout/scrollbar`) renders above the open mega-menu and swallows pointer events over the
   sixth card's right edge. It belongs to the scrollbar re-engineering in Phase D (spec §4,
   §11.7); noting it here so it is not rediscovered as new.
3. Only six cards fit the layout. Today that means "Unikátní kus" (2 products) and "Výrobky se
   slevou" (0 products, excluded as an empty destination) do not appear. Order follows the `rank`
   you set in Medusa admin, so the menu is yours to control.

---

## A3 — footer identity block, honest links, dead routes deleted (spec §3.5, §14 P0 item 0.3)

**Files**

- `src/lib/data/merchant.ts` — **new**, server-only. `getMerchantIdentity()`.
- `src/modules/layout/Footer/index.tsx` — identity block, link map, newsletter.
- `src/modules/layout/Footer/style.scss` — styles for the block; newsletter form styles removed.
- Both layouts — pass `merchant` to `<Footer />`.
- **Deleted:** `src/app/[countryCode]/smluvni_podminky/page.tsx` and
  `src/app/api/reset-password/route.ts` (both 0 bytes).

**Merchant identity block.** The single highest-trust element a Czech e-shop renders, and it was
absent: seller name, registered seat, IČO, e-mail, phone now sit permanently in the footer's brand
column. Address and IČO come from `SIDLO_ADRESA` / `IDENTIFIKACNI_CISLO` — the env vars the audit
found that nothing read — with the registered values as fallbacks so the block cannot render
blank. Seller name is **Lucie Polanská, IČO 03441482** per Matěj's decision (2026-08-04).
`[trust]` `[conversion]`

Those env vars deliberately have no `NEXT_PUBLIC_` prefix, and `Footer` is a client component, so
the module is marked `server-only` and the layouts read it and pass the result down — rather than
re-declaring business data as public env. Values are rendered in `--footer-ink`, not the muted
token: **7.8:1 on the sage surface**, measured. This is information to be read, not atmosphere.

**Link map — one label per destination, no dead ends.**

| Before | After |
|---|---|
| "Smluvní podmínky" **and** "Obchodní podmínky", both → `/smluvni-podminky` | "Obchodní podmínky" (the name the page gives itself) |
| "Kontakt" → `/kontakt` — **404** | removed; contact is permanently visible in the identity block. A4 adds the modal trigger in its place |
| "Reklamační protokol" → `/reklamacni-protokol` — **404** | removed; A5 re-adds it pointing at the real page |
| — | "Používání cookies", "Obchod", "Jak vzniká keramika" fill the freed slots |

Removing the two dead links now rather than waiting for A4/A5 keeps every commit free of 404s.
Verified: all nine internal footer destinations return HTTP 200; `/kontakt`,
`/reklamacni-protokol` and `/smluvni_podminky` all correctly 404. `[trust]` `[clarity]`

**Newsletter — brought forward from A4 (D-S1).** The footer form accepted an address and
discarded it (`preventDefault()` and a TODO). It is replaced by one line and a `mailto:` in the
same footer styling, per D-S1: no platform is chosen yet, and **a dead form must never ship**.
Done here rather than in A4 because it is the same component and the same concern — the footer
being honest — and editing it twice would risk conflicting edits. A4 keeps the kontakt modal.
`[trust]`

**Dead routes.** `smluvni_podminky/page.tsx` (0 bytes, exported nothing, still built as a route
and a 500 risk — spec §12) is gone along with the duplicate label that pointed near it. A second
0-byte file the audit did not list, `src/app/api/reset-password/route.ts`, is also gone: verified
first that nothing references it and that the backend's password-reset e-mail links to the
`/reset-password` **page**, not this route (`backend/src/subscribers/handle-reset-password.ts:49`,
read-only check). `[maintainability]` `[trust]`

**Gate**

- `pnpm lint` → exit 0, no new warnings. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Visual QA at 1024/1280/1536: identity block reads clearly in two columns with Sídlo on its own
  row; footer tone-switching (the sage/dark sampling of the preceding section) still works; link
  columns balanced. A hydration warning appears in the console on `/dotazy` — it originates in
  `DotazyMain`, is unrelated to this change and pre-dates it.
- e2e deferred.

**Notes for Matěj**

- The right-hand footer column now has more empty space than before: the newsletter shrank from a
  form to a line while the brand column grew by the identity block. The whitespace is in the
  original editorial idiom (navigation stays bottom-aligned), so it is left as designed rather
  than re-composed. Say the word if you want the two columns rebalanced.
- Newsletter platform is still parked (D-S1). When you pick one, the mailto line is the only
  thing that needs replacing.

---

## A4 — kontakt modal refit and promotion (D-S1 + D-S5, spec §14 P0 item 0.4)

**Files**

- `src/modules/layout/ContactDialog/` — **new**: `index.tsx` (provider + `useContactDialog`),
  `panel.tsx` (the dialog), `trigger.tsx` (the button), `motion.ts`, `style.module.scss`.
- `src/lib/motion-tokens.ts` — **new**, created early (see below).
- **Deleted:** `src/modules/home/Kurzy/CTA/` (`index.tsx` + global `styles.scss`).
- Migrated call sites: `layout/Navbar`, `dotazy/FAQ`, `home/Kurzy/Intro`.
- `layout/Footer` — "Kontakt" entry is now a dialog trigger; `+ .footer__dialogLink`.
- Both route layouts — mount `ContactDialogProvider`.
- `common/components/Buttons/webButton` — gains `type` and `disabled`.

**Promotion out of Kurzy (D-S5).** The contact dialog lived in `home/Kurzy/CTA` and shipped its
button and its dialog together, so each trigger mounted its own copy — and nothing outside a
component tree could open it. It is now a layout surface: one instance per route layout, opened
through `useContactDialog().open(topic?)`. The footer's Kontakt entry is a button that calls it,
which is what finally removes the `/kontakt` 404 without inventing a route (no `/kontakt` page
is created, per D-S5). Three trigger sites migrated; `Kurzy/Intro`'s CTA now opens pre-set to
the "Kurzy" topic. `[conversion]` `[maintainability]`

**Working submit (D-S1), behind `NEXT_PUBLIC_CONTACT_FORM_ENABLED`.**
`POST {NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/contact` · `{ name, email, phone?, message }` ·
honeypot `website` · `200` → success, `400` → validation copy, `429` → rate-limit copy,
anything else or a network failure → the generic Czech fallback. Every failure message ends with
the atelier's e-mail as a live `mailto:`. The chosen topic rides in the message body
(`Téma: Zakázka\n\n…`) so the agreed contract is untouched.

The flag is **off** by default, and with it off the dialog renders no form at all — it shows
e-mail, phone and address as the way to reach the atelier. A dead form never ships. Turn the flag
on once the backend route is live.

**Accessibility.** `role="dialog"` + `aria-modal` + `aria-labelledby` (already present) now come
with: a real focus trap (Tab and Shift+Tab cycle inside; verified — focus escaped on **0 of 30**
tabs), focus moved to the close button on open and **restored to the trigger** on close, Escape
to close, body scroll lock. Every field has a real `id`/`htmlFor` pair (`useId`), a **13px**
label and its requirement stated in words — "(povinné)" / "(nepovinné)" — not by colour. The
2.1:1 placeholder is gone: placeholders are `#5c5e54` (**6.5:1** on the panel's lightest cream),
labels `#4d4e46` (**8.3:1**). Nothing in the component is below 12px any more — the census here
was 8–11px across meta, eyebrow, legend, fine print and the details card. Topic chips are 44px.
Failures scroll into view, because the form panel scrolls and the alert can otherwise appear
below the fold on the very click that caused it. `[accessibility]` `[readability]` `[trust]`

**Conventions applied (§5).** `styles.scss` (a global emitter concatenated into the 241 KB
sheet) became `style.module.scss` — the trap-1 sanctioned conversion, verified gone from
`_generated-styles.scss`. Declarative motion moved to `motion.ts`; the hook-driven bits stay in
the component. `src/lib/motion-tokens.ts` is created **now rather than in Phase B**: the
convention binds every file I touch, and writing fresh magic numbers into a new `motion.ts`
only to replace them later would be worse. It holds `easeReveal`, `easeMicro` and the duration
budget; Phase B's job becomes adopting it everywhere else, not creating it.

`WebButton` gained `type` and `disabled` because a primary button inside a form has to be able
to submit and to disable itself while in flight; it defaulted to a hardcoded `type="button"`.

**Verified end to end** (dev, flag on, endpoint mocked): submitting posts exactly
`{name, email, phone, message, website:""}` and the success state replaces the form with
"Zpráva odešla." plus the two-working-day promise. With the real (not yet existing) endpoint the
failure state renders the Czech fallback and the support e-mail.

**Gate**

- `pnpm lint` → exit 0, no new warnings. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Visual QA at 1280 (flag off and flag on) plus keyboard-only: dialog opens from the navbar and
  from the footer, ESC closes, focus returns to the trigger, no page errors. The panel's visual
  identity — cream drift, light sweep, grain, clip-path reveal of the photo aside — is unchanged.
- e2e deferred.

**Notes for Matěj**

1. **Backend coordination:** the storefront is ready for `POST /store/contact` exactly as
   specified in D-S1. When it is live, set `NEXT_PUBLIC_CONTACT_FORM_ENABLED=true` on Railway and
   the form replaces the direct-contact panel. Nothing else needs changing.
2. With the flag off, the contact details appear both in the dialog's left panel and in its photo
   card — mild duplication that resolves itself when the form turns on. Left as is rather than
   restructuring a state that is meant to be temporary.

---

## A5 — legal content and the reklamační protokol (spec §14 P0 item 0.5, D-S6)

**Files**

- `src/lib/data/merchant.ts` — extended with `website`, `bankAccount`, `iban`, `swift`.
- `(main)/doprava-a-platba/page.tsx`, `(main)/ochrana-osobnich-udaju/page.tsx`,
  `(main)/odstoupeni-od-smlouvy/page.tsx` — content corrections, all sourced from the merchant module.
- `(main)/reklamacni-protokol/` — **new**: `page.tsx`, `download.tsx`, `download.module.scss`.
- `layout/Footer` — "Reklamační protokol" restored now that the page exists.

**⚠ The most serious finding of Phase A so far: three different bank accounts on one page.**
`/doprava-a-platba` offered bank transfer with **2500675505/2010**, **7010757121/2010** and
**2701281289/2010** in three different sections, and paired two of them with an IBAN belonging to
a *fourth* combination (`CZ55 … 2701281289`). A customer paying by transfer could have sent money
to an account that is not the merchant's.

Ground truth, cross-checked two ways: `.env.local` holds `CISLO_UCTU=7010757121/2010` and
`IBAN=CZ34 2010 0000 0070 1075 7121`, and that IBAN's BBAN decodes to exactly 7010757121/2010.
All three sites now read from `getMerchantIdentity()`, so the page cannot drift again — verified
rendered: one account, one IBAN, one BIC across the whole page. `[trust]`

**Other content corrections**

| Where | Was | Now |
|---|---|---|
| `odstoupeni-od-smlouvy` — seller | "Keramická Zahrada s.r.o." | Lucie Polanská, IČO 03441482 (Matěj, 2026-08-04) |
| `odstoupeni-od-smlouvy` — sample notice | "prostřednictvím vašeho e­shopu **www.eshop.cheesemafia.cz**" | the merchant's own domain |
| `ochrana-osobnich-udaju` — rights | "kontaktujte na **gdpr@prochazkagroup.cz**" | the atelier's e-mail |
| `ochrana-osobnich-udaju` — "Kontakt na DPO" | "**dpo@prochazkagroup.cz**" | "Kontakt na správce údajů" — names the actual controller, seat and IČO, with e-mail and phone |
| `doprava-a-platba` — delivery time | "Každý **kryt** vytváříme na zakázku … dorazí za 1-3 pracovní dny" | stock pieces handed over within two working days of payment; commissions agreed in advance |

The phone-case sentence was false advertising for hand-made ceramics — the audit is right that it
is a leftover from another shop. The DPO section was renamed rather than deleted: a sole trader of
this size does not appoint a data protection officer, but the controller's identity does have to
be stated, so the section now does that job honestly.

**`/reklamacni-protokol` (D-S6).** New page in the existing `LegalDocument` language: when to
claim (including the honest note that glaze and dimension variation in hand-made work is a
property, not a defect), the three-step procedure, the 30-day statutory deadline, and who to
contact. All merchant data interpolated from the one module.

The official PDF is Matěj's to supply. Rather than a download button that 404s, the page ships a
clearly-marked block saying the form is being finalised and pointing at e-mail as the equally
valid route. **To publish it:** drop the PDF into `public/dokumenty/` and set `PROTOCOL_PDF_PATH`
in `reklamacni-protokol/download.tsx` — the download button then replaces the placeholder
automatically, nothing else changes.

Also corrected during QA: step 1 originally read "download the protocol below", which contradicted
the placeholder immediately under it. The steps no longer presuppose the file exists, so the copy
reads correctly both before and after the PDF lands.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0; the new route builds
  at 287 B / 157 kB.
- Visual QA at 1024/1280/1536: the new page matches the legal-document design exactly; the
  download block sits inside chapter 02. Bank details verified in rendered HTML.
- Note: the first dev request to the newly created route returned a Next.js dev-server
  `clientReferenceManifest` 500 — a known first-compile race; every subsequent request, and the
  production build, are clean.
- e2e deferred.

**Notes for Matěj**

1. **Confirm the bank account.** The storefront now shows **7010757121/2010** /
   `CZ34 2010 0000 0070 1075 7121` everywhere, taken from `.env.local` and consistent with the
   IBAN checksum. If any of the three numbers previously on the page was the live one, say so
   before this reaches production.
2. **The reklamační protokol PDF** — see the publishing instructions above.
3. These legal texts are corrected for *accuracy*, not reviewed for legal sufficiency. The
   privacy policy still reads like generic boilerplate ("Jsme společnost…", "Společnostmi v rámci
   naší skupiny") for what is a sole trader. Worth a lawyer's eye before launch; out of scope here.

---

## A6 — payment state pages and the shipped debug output (spec §14 P0 item 0.6)

**Files**

- `src/modules/cart/components/payment-pending/` — **new** (`index.tsx`, `style.module.scss`).
- `(main)/cart/[id]/pending/page.tsx` — rewritten.
- `src/modules/cart/components/payment-confirmed/index.tsx` — failure path.
- `(main)/cart/[id]/confirmed/page.tsx` — passes support contacts.
- `src/modules/checkout/components/payment-button/index.tsx` — logging + a copy typo.
- `(main)/account/@verifyEmail/page.tsx` — customer-data log.

**The pending page.** It rendered `<h1>pending page</h1>`. Bank transfer is a prominently offered
method, so this is where those customers land *after paying*. It now uses the site's own
`OrderStateShell`: what is happening ("banka ji ještě nepotvrdila… u bankovního převodu to bývá i
několik hodin, o víkendu déle"), that nothing is required of them, the reference number they will
need if they call, e-mail and phone, and a quiet note that the page re-checks itself. It refreshes
every 20 s via `router.refresh()`, and shows the real order number instead of the cart reference
when an order already exists. `[trust]` `[conversion]`

**The confirm flow had no failure path.** `placeOrder` + `capturePayment` ran in a `useEffect`
with no `.catch()`: any failure left the customer on "Ještě okamžik…" forever, after paying.
Now both are awaited and failures render a distinct state.

Two details that matter more than they look:

- **A successful `placeOrder` redirects**, and Next signals that by rejecting with a
  `NEXT_REDIRECT` digest. Catching naively would turn every *successful* order into an error
  screen. The handler recognises the redirect signal and lets it through.
- **The failure copy never tells the customer to pay again.** The money has already left their
  account; the page says we have a record of the payment, that we will finish the order by hand,
  and gives the reference plus both contact routes. A "try again" button here would risk a double
  charge.
- A `useRef` guard stops React's development double-effect from placing the order twice.

**Shipped debug output removed.** `console.log("session:", session)` logged the entire payment
session — provider ids, redirect URLs, payment metadata — into the browser console of every
customer reaching the payment step, and two further logs traced the ComGate postMessage flow.
`@verifyEmail` logged the whole customer object (`console.log("Customer data:", customer)`) — PII
in the console. All removed. The now-unused `id` binding in the postMessage handler went with
them, and the inverted branch reads plainly.

Also fixed in passing: the payment button's error read **"Přesměrovací URL ComgateComgate nebyla
nalezena."** — a doubled word in a customer-facing string, in a message that told the customer
nothing useful. It now says the gateway could not be opened and gives the support e-mail.

Debug logging in the reviews and wishlist account pages is left for Phase C's account pass, where
the brief allocates it.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Visual QA at 1024/1280/1536 + reduced motion on `/cart/{id}/pending`: renders in the
  order-state design, all text ≥13px on measured tones.
- The confirmed page's failure branch was reviewed by reading, not exercised: triggering it needs
  a real cart whose completion fails. Flagged rather than claimed. e2e deferred.

**Notes for Matěj**

- `placeOrder` and `capturePayment` fire concurrently on the confirmed page. That is pre-existing
  behaviour and I have not reordered it — capture-then-complete may well be the correct sequence,
  but it is a payment-flow decision that needs the backend's view, not a storefront guess.
  Worth confirming with the backend session.

---

## A7 — mandatory Review step with consent (spec §14 P0 item 0.7)

**Files**

- `src/modules/checkout/components/review/` — `index.tsx` rewritten, **new** `recap.tsx` and
  `motion.ts`, `style.module.scss` rebuilt.
- `src/modules/checkout/components/payment/index.tsx` — no longer redirects to the bank.
- `src/lib/util/comgate.ts` — `buildComgateSessionPayload`, plus the legacy option table moved
  out of the payment component.

**The leak.** `openComgate()` ended in `window.location.assign(...)`: picking a card icon sent
the customer straight to ComGate. The Review step existed but was unreachable in the ComGate
flow — and its "consent" was a passive sentence, not a recorded act. **No terms checkbox existed
anywhere in the application**, which for a Czech e-shop is a compliance gap as much as a
conversion one.

**The flow now.** Payment step → carries the chosen method in the URL (`?step=review&method=…`)
→ Review shows the recap → consent → payment.

The recap answers "let me check everything once more": every object with quantity and line total,
the delivery address, the shipping method, **the Zásilkovna pickup point** (the detail most often
lost between checkout and confirmation — this is the customer's last chance to catch a wrong one),
and the totals with **incl.-VAT "Celkem" as the headline figure** and the VAT amount below it.
The final action reads `Zaplatit 1 379,-` — the amount, not a generic verb. `[trust]` `[conversion]`

**Where consent is recorded, and why there.** The session used to be created in the payment step.
It is now created from Review's final action, *after* `updateCart` writes
`terms_accepted_at` + `terms_version` to the cart metadata. Two reasons for that order: the
consent record exists regardless of what happens at the gateway, and updating a cart can
invalidate a payment session — so consent must never be written to a cart whose session is
already in flight. Existing metadata (including the pickup point) is preserved.

**Bug found while verifying.** The consent sentence rendered at **10px**. `globals.scss` carries a
Tailwind utility `input:not(:placeholder-shown) ~ label { @apply -translate-y-2 text-xsmall-regular }`
for the Input primitive's floating label — and it matches *any* input followed by a label. The
checkbox is now wrapped so the sibling selector cannot match, and the label measures 16px.
**This rule will bite any input+label pair on the site**; it belongs to the Phase B form-primitive
work (P1 item 1.3), noted there rather than fixed globally here.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Verified against a fixture cart on a throwaway local route (removed after; never committed):
  final button reads "Zaplatit 1 379,-"; **disabled before consent, enabled after**; the hint
  "K pokračování prosím potvrďte souhlas s podmínkami." shows while ungated; the checkbox is
  24×24 px in a 44px target with its label programmatically bound; the recap renders items,
  address, pickup point and totals. Computed type in the block: label 16px, section headings
  13px, totals 15–16px — **nothing below 13px**.
- **Not verified against a live purchase (O-13).** See below.

**Notes for Matěj**

- **Blocker found on the backend, not in the storefront:** all three shipping options
  (Česká Pošta ×2, Zásilkovna) currently have **no price** in the CZ region —
  `POST /store/carts/{id}/shipping-methods` fails with *"Shipping options with IDs … do not have
  a price"*. No shipping method can be attached, so **no checkout can currently be completed on
  this backend**, by me or by a customer. Those option IDs were created today, so the backend
  session may simply be mid-edit. This is why A7 is verified against a fixture rather than a real
  order — worth confirming before launch either way.
- Seed products also cannot be added to a cart ("Sales channel … is not associated with any stock
  location"), which is consistent with O-8: the starter data is half-configured. Real ceramics
  variants add fine.

---

## A8 — Czech error layer over the data layer (spec §14 P0 item 0.8)

**Files**

- `src/lib/util/error-messages.ts` — **new**: the mapping table and `toCzechErrorMessage()`.
- `src/lib/constants/contact.ts` — **new**: `SUPPORT_EMAIL` / `SUPPORT_PHONE`, importable from
  client code (the merchant identity module is `server-only`, so it cannot serve this).
- `src/lib/util/medusa-error.ts` — translates instead of capitalising.
- `src/lib/data/customer.ts`, `cart.ts`, `products.ts` — the paths that returned English
  directly, bypassing `medusaError`.

**What / why.** `medusaError` capitalised the backend's English and rethrew it, so
*"Cart with id cart_01ABC was not found."* and *"Insufficient inventory for variant"* reached a
Czech customer mid-checkout. Every `@lib/data` call funnels through this one function, so
translating here covers the whole surface — which is exactly why the spec puts the layer here.

`toCzechErrorMessage()` matches token sets (all tokens must appear, most specific rules first)
across stock, shipping, cart, payment, account, address, discount and transport failures.
Two properties worth stating:

- **Already-Czech messages pass through untouched**, detected by diacritics — so a translated
  backend response is never mangled by a partial English match.
- **Unmapped errors never leak.** They become "Něco se nepovedlo. Zkuste to prosím znovu, nebo
  nám napište na info@keramickazahrada.cz." — what to do next, not what went wrong.

Several `@lib/data` functions returned English strings *without* going through `medusaError`
("Failed to add to cart", "Unknown error", "Verification failed.", "Failed to upgrade account.").
Those now call the mapper directly. Three `console.log`s in `customer.ts` that printed customer
e-mail addresses went with them.

`medusaError` also stopped logging response **headers** — they carry auth tokens — and now logs
one line with status, URL and the raw message for us, while the customer gets the translation.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- The table was exercised standalone against messages **this backend actually returned today**,
  including the two real failures found in A7: the stock-location error and
  "Shipping options with IDs … do not have a price". 9 of 11 cases mapped; "An unknown error
  occurred." and an empty message correctly fell back; an already-Czech message passed through.

**Notes for Matěj**

- The table is a starting set. As real failures show up in production, add rules — one entry per
  pattern in `error-messages.ts`, nothing else to touch.

---

## A9 — add-to-cart feedback, product and bundle (spec §14 P0 item 0.10)

**Files**

- `products/ProductPage/product/details/details.tsx` — `AddToCartState` replaces the bare
  `isAdding` boolean.
- `products/ProductPage/product/details/Cta/Add/index.tsx` — states rendered; availability note.
- `products/ProductPage/product/style.scss`, `products/components/bundle-actions/style.scss`.
- `products/components/bundle-actions/index.tsx` — the bundle path had **no error handling at all**.

**The leak.** Both paths swallowed failures: the PDP handler did `console.error` and reset the
button as if nothing had happened, and the bundle handler had only a `finally`. Success was
signalled solely by the header dropdown opening — off-viewport at the moment of the click. So a
customer could click, see nothing, and click again: double-adds and abandoned carts from the same
defect. The spec calls this the #1 mechanical leak and it is hard to disagree.

**Now**: the button morphs to **"Přidáváme…" → "Přidáno ✓"** and a `role="status"` line reads
"Objekt je v košíku." (bundle: "Soubor je v košíku."), reverting after 4 s; failures render an
inline `role="alert"` under the button carrying **the Czech message from A8's layer**. The
dropdown still opens — it is now confirmation, not the only signal. `[conversion]` `[usability]`

**Contradiction fixed.** The note under the CTA read `inventory_quantity ? "N skladem" : "Není
skladem"`, so every variant with `manage_inventory: false` said **"Není skladem" while the button
beside it said "Přidat do košíku"**. It now follows the same `inStock` the button uses. The full
vocabulary (Skladem / Poslední kus / Prodáno / Na objednávku) is Phase C item 2.1; this is only
the contradiction.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Exercised on a real product (`/cz/products/vlci-mak`) against the live backend:
  **success** — button "Přidat do košíku" → "Přidáno ✓", status line shown, note reads "Skladem",
  dropdown opens. **Failure** — with the server action aborted, the button returns to its resting
  label and the alert reads *"Spojení se serverem se nepodařilo navázat. Zkontrolujte prosím
  připojení a zkuste to znovu."*, which is A8's mapping working end to end in the UI.
- Bundle path verified by build and types only — no bundle product exists in the catalogue to
  click through.

**Notes for Matěj**

- The mini-cart still shows **"Celkem (bez DPH)"** as its headline figure — visible in the QA
  screenshot. That is spec §4's abandonment trigger and is scheduled as Phase C item 2.4
  (incl.-VAT headline totals); not touched here.
- The seed t-shirt is the first card in `/store` and correctly renders as "Není skladem" —
  another symptom of O-8.

---

## A10 — Stripe and PayPal removed (D-S4, spec §11.6)

**Files**

- **Deleted:** `checkout/components/payment-wrapper/stripe-wrapper.tsx`,
  `common/icons/paypal.tsx`.
- Rewritten/trimmed: `payment-wrapper/index.tsx`, `lib/constants.tsx`,
  `payment-button/index.tsx`, `payment-container/index.tsx` (+ its dead Stripe CSS),
  `payment/index.tsx`, `order/components/payment-details/index.tsx`.
- `package.json` — `@stripe/react-stripe-js`, `@stripe/stripe-js`, `@paypal/paypal-js`,
  `@paypal/react-paypal-js` removed.

**Checked before deleting** (§11.4 — deletions where reality might contradict the audit): the
live backend's `/store/payment-providers` for the CZ region returns exactly
**`pp_comgate_comgate`** and **`pp_system_default`**. No Stripe, no PayPal. Nothing was live, so
D-S4 applies as written.

**What this removes.** `payment-wrapper/index.tsx` called `loadStripe(stripeKey)` at **module
scope**, so merely parsing the checkout bundle fetched Stripe's remote script — on every checkout,
for a shop that cannot take Stripe payments. That is gone with the wrapper itself, along with the
`StripePaymentButton`, the `StripeCardContainer` and its CSS, the PayPal script provider and icon,
the `isStripe`/`isPaypal` predicates and the four dead `paymentInfoMap` entries.

Simplifications that fell out: `setPaymentMethod` no longer branches on provider type,
`handleSubmit` loses `shouldInputCard` (there is no card-entry step any more), and the button
label is simply "Pokračovat k přehledu" instead of choosing between that and "Zadat údaje o kartě".

**Measured** (same build, route `/[countryCode]/checkout`):

| | Route JS | First load |
|---|---|---|
| Before (A9) | 40.7 kB | 467 kB |
| After (A10) | **30.5 kB** | **455 kB** |

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- No `stripe`/`paypal` identifier remains anywhere in `src/` except the comment in
  `payment-wrapper` recording why the file is now a passthrough.

**Notes for Matěj**

- `.env.local` still carries `NEXT_PUBLIC_STRIPE_KEY`. Nothing reads it. I have not touched your
  env file — remove it there and on Railway when convenient.

---

## A11 — cookie notice (spec §14 P0 item 0.11, amended by §4)

**Files**

- `src/modules/layout/CookieNotice/` — **new**: `index.tsx`, `motion.ts`, `style.module.scss`.
- `(main)/layout.tsx` — mounts it.

**An informational notice, not a consent gate.** Per §4: no third-party tracker is wired into the
storefront (re-verified — the only cookies are `_medusa_cart_id`, `_medusa_jwt`,
`_medusa_cache_id` and the region choice), so there is nothing to withhold pending consent and a
consent-management platform would be theatre. The notice states what is stored in plain Czech,
links to `/cookies`, and is dismissed with "Rozumím"; the acknowledgement is remembered in
`localStorage`, with the storage access wrapped because private browsing can refuse it (worst
case the notice reappears next visit).

The component comment records the condition that changes this: **if a tracker is ever added, this
has to become a real consent manager.**

Built to the floors: 14px body, 48px action, ink on cream at 14.8:1, `useReducedMotion` skips the
entrance, dismissal is a real `<button>` with a visible focus ring.

Mounted in `(main)` only — not on checkout, which the spec wants kept as a calm zone.

**Gate**

- `pnpm lint` → exit 0. `npx tsc --noEmit` → clean. `pnpm build` → exit 0.
- Verified in the browser: appears on first visit, "Rozumím" is 111×48 px, dismisses, and is
  **still absent after a reload**.

---

# Phase A complete

All eleven P0 tasks are done and committed; `pnpm lint` and `pnpm build` are green on every one.

| | Task | Commit |
|---|---|---|
| A1 | `lang="cs"` + Czech metadata sweep | `50c3886` |
| A2 | Real collections in the navbar | `9255d39` |
| A3 | Footer identity, honest links, dead routes | `9ae77bc` |
| A4 | Kontakt modal refit and promotion | `0095715` |
| A5 | Legal content + reklamační protokol | `6347dcf` |
| A6 | Payment state pages, debug output | `2ad0664` |
| A7 | Review step with consent | `8f4dc6a` |
| A8 | Czech error layer | `3869310` |
| A9 | Add-to-cart feedback | `28966e9` |
| A10 | Stripe/PayPal removal | `e043f48` |
| A11 | Cookie notice | this commit |

**What Phase A set out to fix, and where it stands** (spec §1's three systemic gaps):

- *Prototype seams shipped to production* — fake product menu, inert contact and newsletter forms,
  two 404 links, the `<h1>pending page</h1>` stub, another company's legal boilerplate,
  `<html lang="en">`: all gone. The one placeholder that remains is the reklamační protokol PDF,
  and it is clearly marked as such (O-5).
- *Purchase mechanics* — add-to-cart now confirms and fails audibly, the review step is mandatory
  and records consent before payment, backend English no longer reaches a customer, and the
  payment pages tell the truth.
- *The "archival label" idiom* — untouched by design. That is Phase B's subject, and it is where
  the remaining sub-13px census (footer, scrollbar, product meta) gets retired.

**Not done in Phase A, by instruction:** mobile navigation and touch equivalents (D-S3/A-3 move
them to the final responsive phase).

**Before Phase B, Matěj's attention is needed on the open items above** — particularly **O-1**
(bank account) and the backend blocker noted in A7 (shipping options have no price, so no order
can currently be completed).

---
