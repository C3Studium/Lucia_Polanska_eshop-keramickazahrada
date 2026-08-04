# Opus implementation brief — Keramická zahrada storefront V2.0

Read this whole brief before touching anything. Then follow §12 (Start here).

## 0. Setup — Matěj runs this BEFORE launching the session

The backend Opus session is working in the main working tree on `feat/admin-operating-plan`. The storefront session runs **in its own git worktree** so the two never collide:

```bash
cd /Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada
git worktree add ../keramicka-storefront-v2 -b feat/storefront-v2 main
mkdir -p ../keramicka-storefront-v2/docs
cp StorefrontDesignOptimization.md ../keramicka-storefront-v2/
cp docs/opus-storefront-prompt.md ../keramicka-storefront-v2/docs/
cp storefront/.env.local ../keramicka-storefront-v2/storefront/.env.local   # untracked env does not follow worktrees
cd ../keramicka-storefront-v2/storefront && pnpm install
```

Launch the session in `../keramicka-storefront-v2` and point it at this file. Its first commit adds the two copied documents.

## 1. Mission

You are the implementing engineer for the storefront refinement of **Keramická zahrada** — the Next.js 15 shop in `storefront/` of this worktree. The design audit is complete and approved. **`StorefrontDesignOptimization.md` (repo root) is the specification. Treat the current site as Version 1.0; you are building Version 2.0: the same website, the same visual identity, the same animation philosophy — noticeably more refined, usable, and fast.** This is not a redesign.

The customer you build for: Czech, roughly 35–70, buys handmade ceramics, wears reading glasses, browses slowly on mid-range phones, tablets and older laptops, dislikes learning interfaces. The interface must make them feel: **"Everything is obvious."** If a user has to stop and think "what does this do?", the design failed.

Your human counterpart is **Matěj** (developer, repo owner). He holds env values, deploys, and business decisions. A separate Opus session is doing backend work — you never touch `backend/`, never touch its files, never work outside this worktree.

## 2. Documents — authority order

1. **`StorefrontDesignOptimization.md`** — the spec: 14 sections; §14 is the roadmap this brief re-phases. Every claim in it was verified against source with `file:line` on 2026-08-04 — line numbers will have drifted; paths are stable. Re-verify the specific lines you touch, not the findings.
2. **This brief** — rules of engagement, code conventions, phase order, and Matěj's decisions (§4). Where it scopes pages differently than the doc's page-neutral roadmap, **this brief wins** — it encodes the later per-page agreement.
3. **The code** — ground truth for what exists today.
4. `CART_CHECKOUT_AUDIT.md` — historical July audit of cart/checkout language; useful context, partially implemented already.

**Deviation protocol:** when spec and reality conflict — verify against source → implement the spec's *intent* minimally differently → record it in the log (§11). If the conflict would change a §4 decision, user-visible behavior, or the visual identity: stop and ask Matěj.

## 3. Non-negotiables

1. **Identity is preserved:** the scroll-driven kiln-color journey, masked/vertical button label swaps, magnetic icons, Sentient display voice, per-surface atmospheres (cream catalogue / ink product stage / sage footer), the section-rail scrollbar concept, the calm atelier register. You refine these; you never remove or replace them.
2. **Hard floors (never negotiable, never "except here"):** no customer-facing text below 12 px · every text color from a measured AA pair (spec §7.2) · interactive targets ≥44 px (48 primary) · `prefers-reduced-motion` honored everywhere · never rely on color alone · all customer-visible strings Czech.
3. **Retained pages** — Výroba (`/vyroba`), O mně (`/o-mne`), and the product page's *layout/visual design* — keep their design untouched. The system floors (type, contrast, focus, reduced-motion, performance hygiene) still apply to them; floors are not designs.
4. **The Final Rule:** every change must improve at least one of usability, readability, accessibility, conversion, trust, clarity, maintainability, performance — and you note which, in the log. A change that only "looks cooler" is rejected.
5. Never sacrifice usability for aesthetics. Never hide important actions. Never reduce hierarchy for minimalism.
6. **No fabricated green:** never weaken or skip a gate to pass it. Report failures verbatim.

## 4. Decisions already made (Matěj, 2026-08-04) — do not re-litigate

- **D-S1 · Contact form** goes through a **backend endpoint** that e-mails Lucia via Resend using the backend's `OWNER_NOTIFICATION_EMAIL`. Contract to build against (Matěj relays it to the backend session):
  `POST {MEDUSA_BACKEND_URL}/store/contact` · body `{ name, email, phone?, message }` · honeypot field `website` (reject non-empty silently) · responses `200 {ok:true}` / `400` validation / `429` rate-limit. You implement the kontakt page UI + submit states against this contract behind a feature flag (`NEXT_PUBLIC_CONTACT_FORM_ENABLED`); until the endpoint is live the page shows direct contact details (e-mail, phone, address) prominently — **a dead form must never ship**.
  **Newsletter: build NO function yet** (platform undecided with the client). Replace the current inert input+button with a single line + `mailto:` link in the same footer styling. Same rule: no inert forms.
- **D-S2 · Execution:** this worktree, branch `feat/storefront-v2`, parallel to the backend session. Directories are disjoint; keep them that way.
- **D-S3 · Elevation phase is in scope, code-side only** (Phase E). Photography is Matěj/Lucia's parallel real-world task — Phase E includes the shot-list handoff note; you build with existing images and never block on new ones.
- **D-S4 · Stripe and PayPal are removed entirely.** ComGate is the only PSP. Delete the wrappers, deps, and the module-scope `loadStripe()`; if removal reveals any live usage, stop and show Matěj before deleting.
- **D-S5 · Kontakt is a MODAL, not a page.** Matěj's call, for conversion: the navbar contact modal keeps the customer in context; a standalone page is obsolete. Refit the existing modal (`src/modules/home/Kurzy/CTA/`): working submit per D-S1, full dialog accessibility (focus trap, ESC to close, `aria-modal`, labeled ≥13px AA fields, fix the 2.1:1 placeholder), success/failure states, and **promote it out of the Kurzy module into `src/modules/layout/`** — it is a site-wide surface. The footer "Kontakt" entry becomes a button that opens the modal (removing the dead `/kontakt` href resolves that 404). Do NOT create a `/kontakt` route. Contact details stay permanently visible in the footer identity block so contact never requires a form.
- **D-S6 · `/reklamacni-protokol` ships with a downloadable PDF** — the official complaint-protocol form every Czech e-shop must provide. Page = short Czech explanation + a prominent download button. The legal PDF is supplied by Matěj; until then ship the page with a clearly marked placeholder link and a log note. Link the page from the footer.
- **D-S7 · Desktop/laptop-first — the responsive/mobile port is the FINAL phase of the entire project.** The repo's own SCSS layer system (`src/styles/system/` h-layer/v-layer landscape+portrait breakpoints) is designed for a dedicated, granular responsive pass, and that pass comes last (Phase F). Until then: build and QA for desktop/laptop viewports; do not add mobile-specific UI; do not "fix" small-viewport issues opportunistically. The mobile-first express checkout stays as the campaign escape hatch for phone traffic meanwhile.
- (From the spec) **One WebGL context per page, maximum; checkout/cart/account/legal get zero.** The hero glaze shader is the signature moment; `GlobalLiquidEther` stops being global wallpaper.
- **Analytics/consent:** no third-party tracker is wired in the storefront (verified — "segment" hits in src are fluid-sim geometry). Do not add one. A simple static cookie-info notice suffices; no consent-management platform.

## 5. Code conventions (Matěj's style — binding for every file you touch)

- **framer-motion is the primary animation tool.** No GSAP, no new animation libraries.
- **Declarative motion lives in a `motion.ts` file beside the component and is imported.** Variants, transition objects, stagger configs — all of it. The repo's existing pattern is the model: `src/modules/account/motion.ts`, `src/modules/common/components/premium-action-button/motion.ts`. Components read like markup; motion reads like configuration.
- **Hook-driven animation stays inside the component:** `useScroll`/`useTransform`/`useSpring` chains bind to refs and are clearer in place. **WebGL/shader code also stays inside its component.** Rule of thumb: *if it's data, it goes to `motion.ts`; if it's wiring, it stays put.*
- **Shared motion tokens in one file — `src/lib/motion-tokens.ts`:** the two easing signatures (`easeReveal = [0.76, 0, 0.24, 1]`, `easeMicro = [0.22, 1, 0.36, 1]`) and the duration budget (micro 150–350 ms · reveal 400–700 ms · transition 240 ms). Every `motion.ts` imports from it; no magic numbers or ad-hoc curves in components.
- **Component file shape:** `ComponentName/index.tsx` + `style.module.scss` + `motion.ts` (when animated). Styling is SCSS modules; the token layer `src/styles/system/` (completed in Phase B) is the single source for type, color pairs, spacing, radii, focus. No styled-components. No new Tailwind surface — Tailwind/`@medusajs/ui` remain only where they already exist and shrink over time.
- Server components by default; `"use client"` only where interaction demands it; `next/dynamic` for heavy leaves (shaders, Packeta widget, lightbox).
- Czech strings verbatim from the spec where given; code, comments, commits in English.
- **The readability bar: a mid-level frontend developer opens any file and understands it without a tour.** If a component needs one, split it. When you touch a file that violates these conventions, migrate it as part of the task — never half-in, half-out within one file.

## 6. Per-page scope (converged with Matěj — this overrides page-neutral readings of the spec)

| Page | Scope | Notes |
| --- | --- | --- |
| `/vyroba`, `/o-mne` | **Retain design** | Floors + performance hygiene only (o-mne's ~120 scroll MotionValues get grouped; shader gating) |
| Product page | **Retain design, fix mechanics** | Spec §4: options, feedback, quantity, availability, gallery zoom, sticky purchase, service-note sizes |
| Homepage | **Heavy: recomposition, NOT relayout** | Keep skeleton (kiln journey → hero → sections). Change: real collections everywhere, shop CTA above the fold, section-anchored color keyframes, ONE kinetic showpiece (hero shader stays; `Courses` LiquidImageCarousel → non-WebGL version; 3D wheel simplified per spec §3.1), scroll lock deleted |
| Checkout | **Heavy** | Review step + consent, calm zone, Packeta persistence (copy express-checkout), pending page, Czech errors |
| Kontakt | **Modal refit** (no standalone page — D-S5) | promote out of Kurzy into `layout/`; wire per D-S1; footer triggers it (fixes the 404) |
| `/store` | **Medium refine** | Hero compression, URL filters, sold-out badges, AA labels; grid + load-more pattern stays |
| `/kurzy` | **Medium** | Readability pass (worst tiny-text on site), contact CTA rework per D-S1 |
| Express checkout | **Light: integrate** | It's the reference implementation; link it from campaigns; minor polish only |
| Account + auth pages | **Light** | Inherit primitive fixes; Slovak/English metadata; console.log removal |
| Legal pages | **Content-only** | Wrong-company boilerplate, bank numbers, phone-case copy, 0-byte route — no design work |

## 7. Phases

Work phases in order; tasks within a phase in listed order unless independent. One task at a time: read spec section → implement → gate → log → commit.

**Phase A — Trust & correctness (spec §14 P0, amended by §4).** `lang="cs"` + metadata sweep · real collections in nav (both layouts) · footer identity block + link fixes + delete 0-byte route · **kontakt modal refit** (D-S1 + D-S5) + newsletter mailto-line · legal content fixes + **`/reklamacni-protokol` page with downloadable PDF** (D-S6) · real pending page + `.catch()` on confirm + payment-path console.log removal · **Review step + terms checkbox before ComGate redirect** · Czech error-mapping layer (wrap `lib/util/medusa-error.ts` — one place) · add-to-cart success/failure feedback · Stripe/PayPal removal (D-S4) · cookie-info notice. *(Mobile navigation moved to Phase F per D-S7.)*

**Phase B — The readability & accessibility system (spec §14 P1 + §5.2 + §7.2).** Type tokens + floors (retire sub-12px; fix the mixin `height:` bug) · surface color pairs replacing alpha-muting · one global `:focus-visible` rule, delete all `outline:none` · form primitives (Input `id`, labels ≥13px, "(povinné)", checkbox `useId` + 24px box/44px target, select ring) · target-size floor · reduced-motion three layers (CSS media + `useReducedMotion` + Lenis native path; import `lenis/dist/lenis.css`; anchor offset fix) · **delete the 3-second scroll lock** · heading outline (dotazy h1, footer headings → `<p>`) · `motion-tokens.ts` created; the `motion.ts` convention applies to every component from here on.

**Phase C — Page work (spec §14 P2 + §6 scoping).** Availability vocabulary (Skladem / Poslední kus / Prodáno / Na objednávku) + sold-out card badges · quantity stepper + real inventory caps · generic option rendering · incl.-VAT headline totals · URL-persisted filters + server-side navbar search · Packeta persistence + point on Review/confirmation + phone required · gallery lightbox · accordion dedupe, reviews hidden until content, Czech plurals · store hero compression · sticky PDP purchase column (desktop; the mobile buy bar belongs to Phase F) · homepage recomposition (§6 row) · kurzy pass · account/auth light pass · confirmation surfaces converged (keep `/cart/[id]/*` URLs — they are ComGate return targets — but render the order template) · fake status rail removed.

**Phase D — Optimization (spec §14 P3, in this order).** WebGL policy (dynamic imports, one context, real pause, DPR ≤1.5, context-loss fallback, zero on checkout) · CSS split — **retire `scripts/sync-styles.js`** and the concatenated global sheet (see trap 1) · `next/font/local` migration (variable Sentient, woff2 Sansation, subset; delete the ghost "Poppins-Regular" rule) · image pass (hero double-fetch, `sizes` fixes, Sanity params, `public/` compression) · dead deps removal (`regl`, `axios`, `styled-components`, `@radix-ui/react-accordion`, `react-intersection-observer`, `qs` + D-S4 leftovers) + lodash per-method + wire the bundle analyzer · Scrollbar re-engineering + pointer/rAF hygiene + marquee gating · Lighthouse budget check (**desktop profile** per D-S7: LCP < 2.0 s, TBT < 150 ms, CLS < 0.1; homepage JS < 350 KB gz — the mobile-profile budgets run in Phase F).

**Phase E — Elevation (code-side, D-S3).** Czech typography pass: „uvozovky", non-breaking spaces after one-letter prepositions (k, s, v, z, a, i, o, u), price formatting — as a shared text-formatting util applied to rendered copy · archive numbers (`KZ–YYYY–NNN`, derived display-only from product data; if a real backend field is wanted, flag to Matěj) · provenance strip on PDP (Sanity/product-metadata driven; graceful absence) · handwritten annotations (optional Sanity field, Oooh Baby, `aria-hidden`) · shared-element card→PDP transition (View Transitions API with framer fallback; fully disabled under reduced motion) · order confirmation as certificate · **photography handoff note for Matěj/Lucia** (shot list: per piece — hero on clay-toned seamless matched to `#f2eee5`, glaze macro, scale/context shot; consistent light; you build with existing images meanwhile).

**Phase F — Responsive port (the FINAL phase of the entire project — D-S7).** Runs only after A–E are accepted by Matěj. Built on the existing h-layer/v-layer SCSS breakpoint system (`src/styles/system/_breakpoints.scss`, `_mixins.scss`) — extend it, never replace it. Scope: mobile navigation mounted (`MobileIconsNavbar` + full-screen drawer with real collections, Kontakt trigger, Dotazy) · tap equivalents for every hover-only affordance (products menu, card CTAs, cart popover) · PDP bottom buy bar · filters as a bottom sheet with result-count apply button · inputs ≥16px (kills iOS zoom-on-focus) · WebGL mobile fallbacks verified (context count, DPR, eviction recovery) · small-viewport type/target/contrast verification · full QA at 360 px and 768 px on the seven routes · Lighthouse **mobile**-profile budgets (LCP < 2.5 s, TBT < 200 ms, CLS < 0.1) · device matrix: older iPad Safari, mid-range Android Chrome, 320 px-class viewport (the declared `2xsmall`).

## 8. Verification gates

From `storefront/` in this worktree, after every task:

```bash
pnpm lint && pnpm build
```

- `pnpm build` runs `sync:styles` first and then `next build`. Both must be green before the next task.
- Playwright e2e exists (`pnpm test-e2e`, `e2e/`) but needs a running backend — run it at phase ends when Matěj provides a backend URL; otherwise note "e2e deferred" in the log, never silently skip.
- **Visual QA is part of the gate for UI tasks:** `pnpm dev` (port 8000) and check the touched page against the spec at **1024 px, 1280 px and 1536 px** (desktop-first per D-S7 — 360/768 px checks belong to Phase F), keyboard-only, and with `prefers-reduced-motion` emulated. The seven key routes for full passes (end of Phases B and C): `/`, `/store`, one product, `/cart`, `/checkout`, the kontakt modal, `/dotazy`.
- Phase D ends with a Lighthouse **desktop**-profile run on the seven routes against the §7 budgets; the mobile-profile budgets re-run in Phase F (D-S7).

## 9. Traps — verified in the audit; each will bite if ignored

1. **`scripts/sync-styles.js` regenerates `src/styles/_generated-styles.scss` on every build and dev-watch.** Never hand-edit that file; renaming/moving any global `style.scss` silently changes the bundle. Retire the mechanism in Phase D, not before, and convert files to `*.module.scss` as you touch them.
2. **The SCSS type mixin sets `height:` equal to font-size** (`src/styles/system/_typography.scss`, mixin body) — layouts silently depend on it. When Phase B removes it, visually audit every surface using the mixin tokens; expect wrapping to appear where it was being clipped (that's the fix working).
3. **Lenis:** `lenis/dist/lenis.css` is never imported (the cart drawer's hand-rolled wheel trap exists only because of this); `lenis.stop()` actively swallows wheel/touch; `scrollWithLenis` passes offset 0 so the declared `scroll-margin-top` is ignored — anchors land under the navbar.
4. **Option pickers render only for options literally named `barva`/`color`/`velikost`/`size`** (`Options/Colors`, `Options/Sizes`). Generic rendering must keep those two visually unchanged.
5. **The Input primitive's `htmlFor` points at a `name` with no `id`** (`common/components/input/index.tsx`) — fix the primitive once and every form inherits it; regression-test login, register, and the checkout address step.
6. **`checkbox/index.tsx` hardcodes `id="checkbox"`** — duplicate IDs whenever two render.
7. **`GlobalLiquidEther`'s host is `position:fixed; inset:0`, so its IntersectionObserver is always intersecting** — "it has an observer" does not mean "it pauses". True gating must key off scroll position/route, not intersection of a fixed host.
8. **`<html lang="en">` sits in `src/app/layout.tsx`**; the root and express-checkout `not-found.tsx` are English; forgot-password metadata is Slovak; several titles say "Medusa Store".
9. **`lib/util/medusa-error.ts` capitalises and rethrows raw backend messages** — the Czech mapping layer wraps exactly here, one place; unmapped errors get the generic Czech fallback + support e-mail, never English.
10. **`navigationCollections = []` is hardcoded in BOTH `(main)/layout.tsx` and `(checkout)/layout.tsx`**, with `hardcodedCollections` as the fallback inside `Navbar/productsButton/index.tsx`. Fix both layouts; delete the placeholder data.
11. **`/cart/[id]/{confirmed,pending,canceled}` are ComGate return URLs** — configured backend-side. Fix their *contents* (converge on the order-completed template); do not rename the routes.
12. **Express-checkout is the reference implementation** for Packeta persistence (`packeta_pickup_point_label`) and single-column checkout discipline — copy from it rather than reinventing; it stays functional throughout.
13. **Quantity literals:** PDP hardcodes `quantity: 1`; cart caps at literal `10` regardless of stock.
14. **`public/` is ~80 MB** (six >1.3 MB images on the homepage alone) — Phase D compresses; never add new unoptimized assets meanwhile.
15. **Czech plurals are 3-form** (1 kus / 2–4 kusy / 5+ kusů) — `ShopToolbar` has the correct implementation to copy; three sites get it wrong today.
16. **Worktree hygiene:** `pnpm install` ran fresh here; `.env.local` was copied manually (untracked files don't follow worktrees); never `cd` into the main working tree; never touch `backend/`.

## 10. Git protocol

- All work on `feat/storefront-v2` in this worktree. One commit per completed, green task: `A3: real collections in navbar + placeholder data removed`.
- Pushing the branch is fine. **Never merge to or push `main`** (deploy trigger, Matěj's call). Never commit to `feat/admin-operating-plan`. Never commit `.env*` or secrets.
- Your log is **`docs/storefront-implementation-log.md`** (the backend session owns `docs/implementation-log.md` — never write there). Same format: per task — files, what/why, deviations, gate results, notes for Matěj. Append-only; it is the resume point for any future session.

## 11. Ask Matěj only for

1. Anything production: deploys, DNS, env values on Railway.
2. The contact endpoint's availability (backend session coordination) — until then the feature flag stays off; never block on it.
3. Spec conflicts that would change a §4 decision, the visual identity, or user-visible behavior.
4. Deletions where reality contradicts the audit (e.g., Stripe turns out to be live).
5. Newsletter platform choice — parked by D-S1; do not build ahead of it.

**Never block on:** `OWNER_NOTIFICATION_EMAIL`'s value (backend concern), photography (build with existing images), backend e2e availability (defer with a log note), the reklamační protokol PDF file (ship the page with a clearly marked placeholder link until Matěj supplies the legal document — D-S6).

## 12. Start here

1. Read `StorefrontDesignOptimization.md` fully. Then this brief again, §5–§9.
2. Baseline before any change, from `storefront/`: `pnpm lint && pnpm build` — must be green. If not, stop and report; do not fix unrelated breakage silently.
3. First commit: the two copied documents + `docs/storefront-implementation-log.md` with a baseline entry (lint/build output summary, node/pnpm versions).
4. Begin **Phase A**, task order as listed in §7.

**Definition of done** is the spec's §14 acceptance list, phase-gated: after B — floors + axe clean on the seven routes; after C — keyboard-only purchase possible, one vocabulary per concept, consent recorded before payment; after D — Lighthouse budgets met; after E — elevation items live behind reduced-motion guards. The final test is the spec's: *a first-time 60-year-old visitor completes a purchase without asking anyone for help — and the homepage still feels unmistakably like Keramická zahrada.*
