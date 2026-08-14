# Model 4 — Storefront: error robustness + data honesty + cleanup

You are working in `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/storefront`
(Next.js 15 App Router, React 19, TypeScript, SCSS modules — design system in
`src/styles/system/`, brand: warm paper `#eee8d6`, ink `#212222`, Sentient serif
headings + Sansation UI — see existing SCSS modules for the idiom). Czech
ceramics e-shop, launching 09/2026. Customer-facing text Czech, code English.
Do NOT commit — leave changes in the working tree. Do NOT add npm dependencies;
do NOT edit `package.json`.

Three other models work in this repo in parallel. **File ownership — you may edit:**
- `src/app/**` error/not-found/loading files (create `error.tsx`/`global-error.tsx`)
- `src/app/[countryCode]/(main)/page.tsx`, `kurzy/page.tsx`, `o-mne/page.tsx`
  (the `return null` fix only), account dashboard pages (`account/@dashboard/**`)
- `src/modules/checkout/components/shipping/**` (console noise + Balíkovna logo
  only — nothing else in checkout)
- `src/modules/account/**`, `src/modules/order/**`, `src/modules/products/**`,
  `src/modules/layout/Navbar/**`, `src/modules/common/**`, cart banners
- `src/sanity/**`, `src/lib/**` EXCEPT `src/lib/data/merchant.ts` and
  `src/lib/util/env.ts`
- `next.config.js`, `check-env-variables.js`, `.env.local.template`,
  `.gitignore`, `TODO.md`
- `public/assets/img/**` (Balíkovna logo, if the official files are present)

Do NOT touch: legal pages, Footer, CookieNotice, express-checkout, robots/
sitemap/OG/layout metadata, `src/lib/data/merchant.ts`, `src/lib/util/env.ts`
(another model owns those). If a task seems to need them, note it in your report.

Read every file before editing. Verify each claim below against the code.

## A. Error handling — the site must never show a blank page or a raw stack

1. There is NO `error.tsx` or `global-error.tsx` anywhere. Create branded ones:
   - `src/app/[countryCode]/(main)/error.tsx` (client component: „Něco se
     pokazilo" + „Zkusit znovu" reset button + link home), same for the
     `(checkout)` and `(express-checkout)` groups (calm, minimal — a checkout
     error screen must offer „Zpět do košíku");
   - `src/app/global-error.tsx` (own `<html><body>`, inline styles — it renders
     when the root layout dies).
   Match the brand (paper background, ink text, serif heading) — reuse the
   styling approach of the existing root `src/app/not-found.tsx`.
2. `return null` on data failure renders a blank 200 page. Fix in
   `(main)/page.tsx` (~line 39), `kurzy/page.tsx` (~line 31), `o-mne/page.tsx`
   (~line 33): missing region → `notFound()`; failed upstream fetch → throw so
   the new error boundary catches it. In `kurzy/page.tsx` also delete the
   fetched-but-unused `listCollections`/`getRegion` calls if truly unused.
3. Sanity resilience: `(main)/page.tsx` (~31-36), `kurzy`, `o-mne` call
   `client.fetch()` bare. Wrap in a small helper (e.g. `src/sanity/lib/safe-fetch.ts`)
   that catches, logs once, and returns null → components already have
   fallbacks (`Kurzy/Intro` does; verify HeroSection/ECom handle null and add
   minimal fallbacks where they don't). Also `src/sanity/env.ts` throws at
   import time when env vars are missing, taking the whole storefront down —
   degrade to a warning + disabled Sanity content instead (Studio route may
   still hard-require them; that's fine).
4. `(main)/not-found.tsx` is raw Medusa-starter Tailwind, inconsistent with the
   branded root 404 — restyle to match `src/app/not-found.tsx`.
5. `(express-checkout)/not-found.tsx` ~line 11: `min-h-[calc(100dv-64px)]` —
   `100dv` is not a unit; fix to `100dvh`.

## B. Customer-data logging + dead debug code (ship-blocker hygiene)

- `account/@dashboard/wishlist/page.tsx` — seven `console.log`s incl. full
  wishlist dumps; remove all.
- `account/@dashboard/reviews/page.tsx` — five more + one commented-out; remove.
- `account/@dashboard/reviews/DebugReviewsLogger.tsx` — unimported dead debug
  component; delete the file.
- `src/modules/checkout/components/shipping/index.tsx` — ~30 console calls;
  keep genuinely useful `console.error`s for failures, drop info/noise and
  anything printing payloads.
- Repo-wide sweep for other `console.log` in `src/` (leave `console.error`
  in server actions where it is the only failure signal).

## C. TODO.md debts — investigate and fix each

Work through root `TODO.md` (then update it to reflect reality):
1. „Account page — replace mockup data with real data" — find what is still
   mocked in `src/modules/account/**` / dashboard pages and wire it to the real
   data helpers in `src/lib/data/`. If something has no backend source, hide it
   rather than showing fake numbers — this shop must never show invented data.
2. „FIX the filtering search issue" — reproduce in `src/modules/store/Shop/`
   (FilterPanel ↔ product list): stale/duplicated results when toggling filters
   quickly. Diagnose and fix (likely race between debounced commits — check
   `parseCataloguePriceRange`/list refetch cancellation).
3. „Product page not ready for bundles" — `src/modules/products/components/bundle-actions/`
   and the product template: if a bundled product renders broken UI, either
   finish the minimal buy path or cleanly hide bundle-specific UI so a bundle
   product page is presentable.
4. English strings in `cart-mismatch-banner` and `free-shipping-price-nudge`
   (grep `src/modules` for them) — translate to Czech, match tone of other copy.
5. Loading skeletons: the generic gray Tailwind `animate-pulse` blocks on
   store/product listings — restyle to brand-neutral (paper-tone shimmer),
   only where cheap; do not redesign layouts.
6. `src/modules/account/components/profile-email/index.tsx` — „TODO: we don't
   support updating emails" — verify: if the update is a no-op, replace the
   editable field with read-only display + helper text („E-mail nelze změnit,
   napište mi" style), so nothing pretends to save.
7. `src/modules/order/templates/order-completed-template.tsx` ~line 86 —
   `TODO(BACKEND)` fixed masthead label: derive from `fulfillment_status` /
   order state so a delivered order doesn't read like it just shipped.
8. `products/[handle]/page.tsx` ~line 133 bare `@ts-ignore` — type it properly.

## D. Env/config hygiene

- `check-env-variables.js`: also require `NEXT_PUBLIC_BASE_URL`,
  `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`; warn (not
  fail) on missing `NEXT_PUBLIC_PACKETA_API_KEY` and
  `NEXT_PUBLIC_CONTACT_FORM_ENABLED`.
- `.env.local.template`: `NEXT_PUBLIC_DEFAULT_REGION=us` → `cz`; add the vars
  above with comments; reconcile the commented-out MinIO endpoint with the one
  actually used.
- `next.config.js`: gate the `http://localhost` image pattern to
  `NODE_ENV !== "production"`; unify the hardcoded
  `bucket-production-2be7.up.railway.app` host with the
  `NEXT_PUBLIC_MINIO_ENDPOINT` mechanism (env wins, hardcode goes); LEAVE the
  medusa demo-image hosts for now but mark them clearly — they go when Matěj
  deletes the demo products.
- `src/lib/data/navigation.ts` `SEED_CATEGORY_HANDLES` filter: keep (demo
  products still exist in prod DB) but add a comment that it dies with the demo
  data; verify `/store` doesn't crash on the English apparel.
- `.gitignore`: add `tsconfig.tsbuildinfo` (887 KB committed build artifact) —
  note in the report that Matěj should `git rm --cached` it.
- `src/app/api/account/password/route.ts` localhost fallback — route through
  the same backend-URL constant `src/lib/config.ts` uses instead of an inline
  literal.

## E. Balíkovna official logo (conditional)

`public/assets/img/balikovna.svg` is an approximation; the official logos from
the ČP implementation package should replace it. IF official logo files exist
in the repo or are provided during your run: pick the primary „Balíkovna"
mark, optimize (SVG preferred), replace the file (same path/name so
`src/modules/checkout/components/shipping/index.tsx` needs no change), and
check it renders at 24-32 px in the option row. If the files are not present,
skip and note it.

## F. Navbar search (bounded fix only)

`src/modules/layout/Navbar/navbarSearch/index.tsx` ~line 576: the fallback
loads the ENTIRE catalogue client-side in a paged loop. Do not build a search
service today — just bound it: cap pages/items sensibly, debounce, and make
the „zobrazit všechny výsledky" path go to `/results/[query]` which queries the
backend. Leave the `TODO(search-service)` marker for the future.

## Gate (run at the end, fix what breaks)

```
cd storefront
npx tsc --noEmit
pnpm build
```
If a concurrent model's build collides with yours, rerun. Finish with a report:
what you fixed, what you deleted, what TODO.md items remain and why, and
anything discovered that belongs to another model's territory.
