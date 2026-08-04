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
