# Storefront V2.0 — implementation log

Append-only record of the storefront refinement pass (`feat/storefront-v2`).
Specification: `StorefrontDesignOptimization.md` · Rules of engagement: `docs/opus-storefront-prompt.md`.
The backend session owns `docs/implementation-log.md` — nothing here is written there.

Format per task: **files** · **what/why** · **deviations** · **gate** · **notes for Matěj**.

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
