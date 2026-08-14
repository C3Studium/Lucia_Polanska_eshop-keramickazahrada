# CHECK — full storefront audit (read-only)

You are auditing `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/storefront`
(Next.js 15 App Router, React 19, TypeScript, SCSS modules — design system in
`src/styles/system/`; brand: warm paper `#eee8d6`, ink `#212222`, Sentient serif
+ Sansation) — the storefront of a Czech ceramics e-shop launching 09/2026.
Your job is a COMPLETE production-readiness audit. You change NO source code.
Your only write is your report: `docs/sprint-2026-08-14/report-storefront.md`
(repo root relative). A parallel model audits the backend; treat `../backend`
as read-only reference (grep to verify endpoints, don't report backend-only
issues).

Your report drives 4 implementation prompts written afterwards. The goal state:
**both halves code-complete so that only carrier/invoice API credentials remain
to be set in Railway.** Every claim with `file:line`; label uncertainties.

## Decisions already made (audit against these, don't relitigate)

- **Lucia is NOT plátce DPH** — prices are final, no VAT anywhere. Sweep ALL
  customer-facing copy (legal pages, checkout, product pages, e-mailed order
  summaries rendered by storefront, cart) for „DPH"/„VAT"/„vč. daně" claims and
  list every occurrence (the terms currently claim she IS a VAT payer — wrong).
- **Doprava a platba goes dynamic**: the page must render a generated block of
  the REAL shipping options with current prices, plus a per-option packaging-
  cost range (min–max across products; packaging price per product is in the
  DB). Investigate feasibility (see D1).
- **Kurzy bookings = inquiry form** (name, phone, e-mail, message) styled like
  the site. Investigate what exists (see D2).
- **Packeta not offered** for now (provider stays in backend code) — note any
  storefront UI that would render a Packeta option or widget if the option
  reappears; it must degrade gracefully, not break.
- **iDoklad deferred** to the last pre-launch change — out of scope.

## A. Verify the prior audit (2026-08-14) — confirm, correct, or refute each

1. **Legal pages** — `(main)/smluvni-podminky/data.ts`: unfilled blanks in
   binding clauses (~36 order button name, ~106 complaints e-mail, ~116
   truncated enumeration); repealed zákon 101/2000 Sb. cited (~115); no ADR/ODR
   clause (~107); dated „1.1. 2015 / V Písku" (~141); bank accounts
   2500675505/2010 + 2701281289/2010 vs `src/lib/data/merchant.ts` ~37
   (7010757121/2010); embedded TODO ~81. `ochrana-osobnich-udaju/page.tsx`:
   corporate boilerplate („Jsme společnost", „skupina", no real processors, no
   ÚOOÚ complaint right). `cookies/page.tsx`: claims Google Analytics + cookie
   settings that don't exist (~79); stub section whose body is the word
   „Cookies" (~22-25); dead „na konci této stránky" claim (~18).
   `odstoupeni-od-smlouvy/page.tsx`: form only, no prose despite metadata
   promising „postup, lhůty". `doprava-a-platba/page.tsx`: contradictory
   duplicated price lists (79 vs 89, 95/99/99, „(CZ, varianta 2)"), defunct
   „PlatímPak/Equa Bank" (~111-114), empty divider sections. Reklamační řád
   naming: one document under three names; `reklamacni-protokol/download.tsx`
   `PROTOCOL_PDF_PATH = null` + TODOs; `src/modules/order/components/carrier-damage/`
   links + visible „Dokument sem doplníme" block.
2. **Consent**: main checkout terms checkbox is DONE and correct
   (`src/modules/checkout/components/review/index.tsx` ~201-259, recordConsent
   + TERMS_VERSION) — verify it still holds; express checkout has NO checkbox
   (`src/modules/express-checkout/Payment/index.tsx` ~202-205) and a dead end
   when the gateway list is empty (~207-210). Footer newsletter consent is a
   sentence, not an opt-in checkbox.
3. **Cookie banner** (`src/modules/layout/CookieNotice/`): informational only,
   truthful today (no analytics anywhere in the repo — verify grep again);
   contradicts the cookies page.
4. **SEO**: dead `next-sitemap.js` (package not installed, no postbuild, string
   concat bug in exclude); no robots.ts/sitemap.ts; no staging-noindex
   mechanism; `src/app/opengraph-image.jpg` + `twitter-image.jpg` = Medusa
   starter „Next.js Starter Template" images; `public/favicon.ico` possibly
   starter; `generateMetadata` only on products + order detail (store,
   collections, categories, search, results have none); no canonical
   alternates; `src/lib/util/env.ts` defaults `metadataBase` to
   `https://localhost:8000`.
5. **Robustness**: no `error.tsx`/`global-error.tsx` anywhere; `return null` →
   blank 200 on `(main)/page.tsx` ~39, `kurzy/page.tsx` ~31, `o-mne/page.tsx`
   ~33; bare Sanity `client.fetch()` without catch (homepage ~31-36, kurzy,
   o-mne); `src/sanity/env.ts` throws at import time on missing env;
   `(main)/not-found.tsx` raw starter styling; `(express-checkout)/not-found.tsx`
   `100dv` typo ~11.
6. **Data honesty / cleanup**: seven console.logs dumping wishlist data
   (`account/@dashboard/wishlist/page.tsx`), five in reviews page + dead
   unimported `DebugReviewsLogger.tsx`; ~30 console calls in
   `src/modules/checkout/components/shipping/index.tsx`; root `TODO.md` debts
   (account mockup data, „FIX the filtering search issue", product page not
   ready for bundles, English `cart-mismatch-banner` + `free-shipping-price-nudge`,
   generic gray skeletons); `profile-email` update possibly a no-op (~19);
   `order-completed-template.tsx` ~86 fixed masthead label TODO(BACKEND);
   `products/[handle]/page.tsx` ~133 bare @ts-ignore;
   `src/lib/data/navigation.ts` seed-handle filter hiding demo apparel;
   navbar search full-catalogue client loop (`navbarSearch/index.tsx` ~576).
7. **Env/config**: `next.config.js` — `http://localhost` image pattern in prod,
   hardcoded `bucket-production-2be7.up.railway.app`, three medusa demo image
   hosts; `check-env-variables.js` validates only the publishable key;
   `.env.local.template` `NEXT_PUBLIC_DEFAULT_REGION=us`; contact form gated on
   `NEXT_PUBLIC_CONTACT_FORM_ENABLED` absent from `.env.local`;
   `tsconfig.tsbuildinfo` committed; hardcoded localhost fallback in
   `src/app/api/account/password/route.ts` ~35.

## B. Fresh full sweep — what the prior audit missed

Walk ALL of `src/` (every route group incl. checkout + express-checkout +
account, all modules, lib/data helpers, api route handlers, hooks, providers,
middleware.ts, i18n/copy) hunting anything not production-ready: flows that
dead-end, UI promising actions with no backend, broken states on empty data,
mobile-hostile layouts flagged in code comments, accessibility landmines
(unlabeled icon buttons in critical flows), hydration hazards, unhandled
rejections in server actions, hardcoded Czech-crown formatting drift, wishlist/
review/restock/price-watch flows end-to-end (do their endpoints exist in
`../backend/src/api`? — grep to confirm each), Sanity-driven pages with no
content fallback, the `/studio` route exposure. Check `public/` for leftover
starter assets. Ignore cosmetics that don't affect launch.

## C. Runtime spot-checks (optional, read-only)

If the deployed staging storefront/backend respond (URLs + publishable key in
`.env.local` / `src/lib/config.ts`): confirm which shipping options and payment
providers the store API actually returns today (names, amounts, provider ids)
and whether demo apparel products still come back from `/store/products`.
GETs only; at most one throwaway cart if options require it; never complete
checkout. Record trimmed evidence; mark UNVERIFIED if unreachable.

## D. Investigations the implementation prompts need answered

1. **Dynamic doprava-a-platba**: which existing helpers in `src/lib/data/`
   (fulfillment/cart) can list shipping options WITHOUT a cart; whether product
   packaging costs are visible via the store API from the storefront (exact
   metadata keys if yes); the cleanest rendering plan for „option price +
   packaging range (min–max)" as a server component. If data is missing
   store-side, state precisely what endpoint the backend must add (coordinate
   wording: the backend report has the same question from its side).
2. **Kurzy inquiry form**: current CTA path (`Kurzy/Intro` → ContactDialog),
   what `ContactDialog`'s form actually submits to (endpoint? mailto? the
   `NEXT_PUBLIC_CONTACT_FORM_ENABLED` gate), and the plan for a
   name/phone/e-mail/message form embedded on `/kurzy` in the site's visual
   language — reuse vs new component, where it posts, spam protection.
3. **DPH sweep** (decision above): the full occurrence list.
4. **Express checkout**: full current state — is the flow completable end to
   end (handle → payment → confirmation), which pieces are ComGate-only, where
   consent must go.
5. **Search filter bug** („FIX the filtering search issue" in TODO.md):
   reproduce from code (`src/modules/store/Shop/` FilterPanel ↔ list fetch),
   name the root cause precisely enough that a fix prompt needs no re-diagnosis.
6. **Account mockup data**: exactly which dashboard surfaces render fake/
   hardcoded data and what real helper each should use.

## Report format (`docs/sprint-2026-08-14/report-storefront.md`)

Markdown, these sections: **1. Confirmed** (finding + file:line, one line each)
· **2. Corrected/refuted** (with proof) · **3. New findings** (severity-ranked:
blocker / must / nice) · **4. Runtime state** (C — evidence or UNVERIFIED) ·
**5. Implementation answers** (D — concrete) · **6. Suggested split** (your
opinion: how the storefront work divides into 2 parallel non-conflicting
workstreams — file-ownership lists).

You may run `npx tsc --noEmit` to establish the baseline (report the result).
No file edits, no commits, no installs.
